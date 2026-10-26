# Maple Grove outbound call

Use the existing **Maple Grove Receptionist** agent. Do not create a second agent.
The n8n workflow `elevenlabs-outbound-call.json` places the call and sends the
opening line as the `opening_line` variable. These agent settings tell the agent
it is the one who called.

## Security

Leave every override off, including First message. ElevenLabs rejects the dial
when a first-message override is sent and that switch is off. The greeting is
a dynamic variable instead.

## Dynamic variables

Add these next to the existing `organization_id` variable. The placeholder is for the agent preview only. A real inbound phone call
does not use it. The n8n workflow `elevenlabs-inbound-initiation.json` sends
these values when the clinic number is called.

| Name | Placeholder |
|---|---|
| `direction` | `inbound` |
| `patient_name` | `there` |
| `call_reason` | `your recent visit` |
| `opening_line` | `Thank you for calling Maple Grove Dental Clinic. This is the virtual receptionist. How can I help you today?` |

## System prompt

Append this to the end of the current system prompt:

```text
Call direction is {{direction}}.
When direction is outbound, you placed this call. The patient's name is {{patient_name}}. The reason for the call is {{call_reason}}. You already greeted them by name and stated the reason. Wait for their reply. If they are busy, offer a callback and end the call. If they can talk, handle the reason the same way you handle an inbound request: collect what the front desk needs, and tell them the front desk will confirm any appointment time. Do not ask "how can I help you today?" as if they called the clinic.
When direction is inbound, ignore call_reason and patient_name and handle the call as an incoming call.
```

## Inbound initiation

In the agent Security tab, enable **Fetch initiation client data from a webhook**
and select the workspace webhook for
`https://mannie333.app.n8n.cloud/webhook/elevenlabs-inbound`.
Leave the post-call webhook on `/webhook/elevenlabs-call`.

Without that initiation webhook, an inbound call has no `opening_line` and
ElevenLabs hangs up in about a second.

## First message

Replace the first message with exactly this. Inbound calls speak the line from
the initiation webhook. Outbound calls speak the line the outbound workflow sends.

```text
{{opening_line}}
```
