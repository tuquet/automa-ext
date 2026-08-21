
import { sendMessage } from '@/utils/message';
export default function (context, message) {
  if (context === 'background') {
    initWorkerDaemon(message);
  } else if (context === 'offscreen') {
    initOffscreenDaemon(message);
  }
}

async function initOffscreenDaemon(messageListener) {
  console.log('[Automa Daemon] Initializing offscreen monkey-patches...');
  const { default: WorkflowEngine } = await import('@/workflowEngine/WorkflowEngine');

  const originalAddLogHistory = WorkflowEngine.prototype.addLogHistory;
  WorkflowEngine.prototype.addLogHistory = function (detail) {
    originalAddLogHistory.call(this, detail);
    
    if (this.options?.isDaemonJob && this.options?.jobId) {
      sendMessage('daemon:log', {
        jobId: this.options.jobId,
        data: { type: 'log', logs: [detail] }
      }, 'background').catch(console.error);
    }
  };

  const originalDispatchEvent = WorkflowEngine.prototype.dispatchEvent;
  WorkflowEngine.prototype.dispatchEvent = function (name, params) {
    originalDispatchEvent.call(this, name, params);
    
    if (this.options?.isDaemonJob && this.options?.jobId && name === 'destroyed') {
      sendMessage('daemon:finish', {
        jobId: this.options.jobId
      }, 'background').catch(console.error);
    }
  };
}

async function initWorkerDaemon(message) {
  console.log('[Automa Daemon Worker] Initializing SSE connection...');
  let eventSource = null;

  async function connect() {
    let browserId = 'daemon_worker';
    try {
      const configRes = await fetch(chrome.runtime.getURL('daemon.json'));
      if (configRes.ok) {
        const config = await configRes.json();
        if (config.browserId) browserId = config.browserId;
      }
    } catch (e) {
      // Ignored
    }

    try {
      const response = await fetch(`http://127.0.0.1:8765/api/internal/worker/events?browserId=${browserId}`);
      console.log(`[Automa Daemon Worker] Connected to Rust Daemon (Browser: ${browserId}).`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep the incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const payload = JSON.parse(dataStr);
              if (payload.jobId && payload.workflowData) {
                console.log(`[Automa Daemon Worker] Received Job ${payload.jobId}`);

                const triggerNode =
                  payload.workflowData.drawflow?.nodes?.find(
                    (n) => n.label === 'trigger' || n.type === 'trigger'
                  ) ||
                  payload.workflowData.nodes?.find(
                    (n) => n.label === 'trigger' || n.type === 'trigger'
                  );
                const defaultVars = {};
                if (triggerNode?.data?.parameters) {
                  triggerNode.data.parameters.forEach((param) => {
                    if (param.name && param.defaultValue !== undefined) {
                      defaultVars[param.name] = param.defaultValue;
                    }
                  });
                }
                const mergedVars = {
                  ...defaultVars,
                  ...(payload.options?.variables || {}),
                };

                console.log(`[Automa Daemon Worker] Invoking executeWorkflow for ${payload.jobId}...`);
                const { default: BackgroundWorkflowUtils } = await import('@/background/BackgroundWorkflowUtils');
                BackgroundWorkflowUtils.instance.executeWorkflow(payload.workflowData, {
                  jobId: payload.jobId,
                  isDaemonJob: true,
                  checkParams: false,
                  data: {
                    variables: mergedVars,
                  },
                }).then(() => {
                  console.log(`[Automa Daemon Worker] executeWorkflow FINISHED for ${payload.jobId}`);
                }).catch(err => {
                  console.error('[Automa Daemon Worker] executeWorkflow error:', err);
                  fetch(`http://127.0.0.1:8765/api/jobs/${payload.jobId}/logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'error', message: 'executeWorkflow failed: ' + String(err) })
                  }).catch(console.error);
                });
              }
            } catch (e) {
              console.error('[Automa Daemon Worker] Error parsing job payload:', e);
            }
          }
        }
      }
      
      console.debug('[Automa Daemon Worker] Connection closed. Reconnecting in 5s...');
      setTimeout(connect, 5000);
    } catch (e) {
      console.debug('[Automa Daemon Worker] Connection error. Reconnecting in 5s...', e);
      setTimeout(connect, 5000);
    }
  }

  connect();

  message.on('daemon:log', async (payload) => {
    try {
      await fetch(`http://127.0.0.1:8765/api/jobs/${payload.jobId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data)
      });
    } catch (e) {
      console.error('[Automa Daemon] Failed to push log', e);
    }
  });

  message.on('daemon:finish', async (payload) => {
    try {
      await fetch(`http://127.0.0.1:8765/api/jobs/${payload.jobId}/status`, {
        method: 'PATCH'
      });
    } catch (e) {
      console.error('[Automa Daemon] Failed to finish job', e);
    }
  });
}
