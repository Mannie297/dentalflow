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
| `upcoming_visit` | `none` |

## System prompt

The full system prompt, including this direction paragraph, is in `appointment-tools.md`. Replace the agent's prompt with that text. Do not append this paragraph a second time.

```text
Call direction is {{direction}}.
When direction is outbound, you placed this call. The patient's name is {{patient_name}}. The reason for the call is {{call_reason}}. The upcoming visit is {{upcoming_visit}}. You already greeted them by name and stated the reason. Wait for their reply. If they are busy, offer a callback and end the call. If they can talk and upcoming_visit is none, they have nothing booked. Invite them to book, using the reason for the call. If upcoming_visit names a visit, confirm that visit. Do not book a second visit while one is already upcoming. Book, reschedule, or cancel only when they ask. For those tools, send {{system__called_number}} as the phone. Ask for a callback number only when {{system__called_number}} is empty. Do not ask "how can I help you today?" Do not ask for their name again. Do not tell them the front desk will confirm a time.
When direction is inbound, ignore call_reason, patient_name, and upcoming_visit and handle the call as an incoming call.
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
