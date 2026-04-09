import axios from 'axios';

/**
 * Dispatch an alert to Slack using Webhooks + Block Kit.
 * Relies on SLACK_WEBHOOK_URL implicitly existing.
 */
export const notifyDrift = async (
  projectName: string,
  environment: string,
  actorName: string,
  added: number,
  removed: number,
  updated: number
) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // Silent skip if no config

  const blockPayload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '⚠️ EnvGuard Schema Drift Detected', emoji: true }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${actorName}* just pushed a schema update for *${projectName}* \`(${environment})\`.\n> *Added:* ${added}\n> *Updated:* ${updated}\n> *Removed:* ${removed}`
        }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Run `envguard pull` locally to synchronize your environment.' }]
      }
    ]
  };

  try {
    await axios.post(webhookUrl, blockPayload);
  } catch (error: any) {
    console.error('[Notify Service] Failed to dispatch Slack webhook:', error?.message);
  }
};
