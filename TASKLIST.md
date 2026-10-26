# DentalFlow AI — Task List

This file preserves the original master prompt/specification used to build this
project, broken down into the staged deliverables it defines. See
`PROGRESS.md` for the live status of each stage.

## Stages (from the original spec, section 50 "DELIVERABLES")

1. Create project architecture.
2. Create design system.
3. Create navigation/layout.
4. Create Dashboard.
5. Create Calls.
6. Create Leads.
7. Create Appointments.
8. Create Campaigns.
9. Create AI Receptionist.
10. Create Knowledge Base.
11. Create Analytics.
12. Create Reports.
13. Create Settings.
14. Connect Supabase.
15. Connect n8n event endpoints.
16. Testing and production hardening.

After completing each stage:
1. Run the application.
2. Check TypeScript errors.
3. Check lint errors.
4. Fix errors.
5. Verify responsive behavior.
6. Do not move to the next stage until the current stage is functional.

Do not rewrite working components unnecessarily.

---

## Original Prompt (verbatim)

> use this master propmt as a product specification, then implement the dashboard in stages - You are a senior SaaS product architect, UX designer, frontend engineer, backend engineer, and AI automation engineer.
>
> Build a production-quality MVP dashboard for an AI-powered dental clinic receptionist and patient acquisition platform.
>
> PRODUCT NAME:
> DentalFlow AI
>
> PRODUCT PURPOSE:
> DentalFlow AI helps dental clinics automatically manage inbound calls, outbound calls, missed calls, patient inquiries, appointment booking, appointment reminders, patient follow-up, recall campaigns, reviews, and AI-generated business insights.
>
> The MVP is specifically designed for dental clinics in Ontario, Canada.
>
> IMPORTANT:
> Do NOT build this as a generic admin dashboard.
>
> The primary objective is to help a dental clinic owner or office manager understand:
>
> 1. How many calls were received
> 2. How many calls were missed
> 3. How many leads were generated
> 4. How many appointments were booked
> 5. How many appointments were cancelled
> 6. How many patients were recovered through automation
> 7. How many outbound calls were made
> 8. How many appointments resulted from outbound campaigns
> 9. Estimated revenue opportunity
> 10. AI-generated recommendations for improving patient acquisition and conversion
>
> The dashboard must feel like a professional commercial SaaS product that could eventually be sold to real dental clinics.
>
> ==================================================
> 1. TECHNOLOGY STACK
> ==================================================
>
> Use:
>
> Frontend:
> - Next.js
> - React
> - TypeScript
> - Tailwind CSS
> - shadcn/ui
> - Lucide icons
> - Recharts
> - React Query / TanStack Query
> - Zustand where global client state is required
>
> Backend:
> - Next.js API routes OR a clean FastAPI API abstraction
> - Design the frontend so backend implementation can later be separated into FastAPI without major refactoring.
>
> Database:
> - Supabase
> - PostgreSQL
>
> Authentication:
> - Supabase Auth
>
> Authorization:
> - Role-based access control
> - Organization/clinic-based multi-tenancy
>
> Automation:
> - n8n
>
> AI:
> - OpenAI
>
> Voice:
> - Twilio
>
> Email:
> - Resend or equivalent provider
>
> SMS:
> - Twilio
>
> Calendar:
> - Google Calendar initially
>
> Payments:
> - Stripe later
>
> Charts:
> - Recharts
>
> Deployment:
> - Vercel frontend
> - Supabase database
> - n8n automation server
>
> ==================================================
> 2. DEVELOPMENT PRINCIPLES
> ==================================================
>
> Build the application as a real SaaS product.
>
> DO NOT:
> - hardcode dashboard numbers
> - create fake static components that cannot later connect to Supabase
> - tightly couple UI components to database queries
> - put business logic directly inside React components
> - create duplicated components
> - create unnecessary pages
> - create a generic template dashboard
>
> DO:
> - create reusable components
> - create typed interfaces
> - create service/API abstraction layers
> - use mock data only when necessary for initial UI development
> - clearly separate mock data from production data
> - create loading states
> - create empty states
> - create error states
> - create responsive layouts
> - create proper TypeScript types
> - prepare all dashboard components for Supabase integration
> - create reusable chart components
> - create reusable KPI components
> - use realistic dental clinic terminology
>
> ==================================================
> 3. USER ROLES
> ==================================================
>
> Support these roles:
>
> ADMIN
> - full access
>
> CLINIC_OWNER
> - full clinic analytics
> - calls
> - patients
> - appointments
> - campaigns
> - AI insights
>
> OFFICE_MANAGER
> - calls
> - patients
> - appointments
> - campaigns
> - reports
>
> RECEPTIONIST
> - patients
> - calls
> - appointments
> - limited analytics
>
> The dashboard must always filter data by organization_id.
>
> Never allow one clinic to see another clinic's data.
>
> ==================================================
> 4. MAIN NAVIGATION
> ==================================================
>
> Create a professional left sidebar.
>
> Navigation:
>
> Dashboard
> Calls
> Patients
> Appointments
> Leads
> Campaigns
> AI Receptionist
> Knowledge Base
> Analytics
> Reports
> Settings
>
> Sidebar should include icons.
>
> At the bottom:
>
> Clinic profile
> User name
> Role
> Settings
> Logout
>
> Support collapse/expand behavior on desktop.
>
> Mobile should use a drawer.
>
> ==================================================
> 5. GLOBAL TOP BAR
> ==================================================
>
> Top navigation should include:
>
> - Current clinic name
> - Date range selector
> - Global search
> - Notifications
> - User profile
>
> Date range options:
>
> Today
> Yesterday
> Last 7 days
> Last 30 days
> Last 90 days
> Custom
>
> Changing the date range should update all relevant dashboard metrics.
>
> ==================================================
> 6. MAIN DASHBOARD
> ==================================================
>
> Create:
>
> /dashboard
>
> This is the most important page.
>
> The layout should contain:
>
> A. Header
> B. KPI cards
> C. Call activity
> D. Appointment conversion
> E. Lead funnel
> F. Revenue opportunity
> G. Recent activity
> H. AI insights
> I. Upcoming appointments
> J. Missed call recovery
> K. Campaign performance
>
> ==================================================
> 7. DASHBOARD HEADER
> ==================================================
>
> Display:
>
> Good morning, Dr. [Name]
>
> Here's what happened at [Clinic Name].
>
> Date range selector.
>
> Primary CTA:
>
> "View AI Insights"
>
> Secondary CTA:
>
> "Launch Campaign"
>
> Another CTA:
>
> "View Calls"
>
> ==================================================
> 8. KPI CARDS
> ==================================================
>
> Create six primary KPI cards.
>
> CARD 1:
>
> Total Calls
>
> Example:
>
> 247
>
> +12.4% vs previous period
>
> Subtext:
>
> Inbound + outbound
>
> Icon:
> Phone
>
> Clicking opens Calls page.
>
> --------------------------------------------------
>
> CARD 2:
>
> Missed Calls
>
> Example:
>
> 18
>
> -23% vs previous period
>
> Subtext:
>
> 7 recovered
>
> Use a visual indicator showing whether missed calls are improving.
>
> --------------------------------------------------
>
> CARD 3:
>
> New Leads
>
> Example:
>
> 86
>
> +15.3%
>
> Subtext:
>
> From calls + web + chat
>
> --------------------------------------------------
>
> CARD 4:
>
> Appointments Booked
>
> Example:
>
> 64
>
> +18.2%
>
> Subtext:
>
> 42 new patients
>
> --------------------------------------------------
>
> CARD 5:
>
> Conversion Rate
>
> Example:
>
> 74.4%
>
> +6.8%
>
> Definition:
>
> Qualified inquiries that resulted in appointments.
>
> --------------------------------------------------
>
> CARD 6:
>
> Estimated Revenue Opportunity
>
> Example:
>
> $18,450
>
> +21.3%
>
> Subtext:
>
> Based on booked/recovered opportunities.
>
> IMPORTANT:
> Clearly label this as ESTIMATED REVENUE rather than actual revenue unless actual revenue data is connected.
>
> ==================================================
> 9. CALL ACTIVITY SECTION
> ==================================================
>
> Create a large chart.
>
> Title:
>
> Call Activity
>
> Display:
>
> Inbound calls
> Outbound calls
> Missed calls
> Answered calls
>
> Use a line or area chart.
>
> X-axis:
> date
>
> Y-axis:
> number of calls
>
> Allow user to toggle metrics.
>
> Below chart display:
>
> Answered:
> 229
>
> Missed:
> 18
>
> Outbound:
> 94
>
> Average call duration:
> 3m 42s
>
> ==================================================
> 10. APPOINTMENT CONVERSION
> ==================================================
>
> Create a conversion funnel:
>
> Calls / inquiries
>         ↓
> Qualified leads
>         ↓
> Appointment requested
>         ↓
> Appointment booked
>         ↓
> Appointment completed
>
> Display numbers and percentages.
>
> Example:
>
> 247 inquiries
>
> ↓
>
> 86 qualified
>
> ↓
>
> 72 requested appointment
>
> ↓
>
> 64 booked
>
> ↓
>
> 51 completed
>
> Use visual funnel design.
>
> ==================================================
> 11. LEAD FUNNEL
> ==================================================
>
> Create a lead pipeline visualization.
>
> Stages:
>
> New
> Contacted
> Qualified
> Appointment Requested
> Booked
> Completed
> Lost
>
> Use counts and conversion percentages.
>
> Allow filtering by:
>
> Service
>
> Source
>
> Campaign
>
> Date
>
> ==================================================
> 12. SERVICE PERFORMANCE
> ==================================================
>
> Create a section showing which dental services generate the most opportunities.
>
> Services:
>
> General Cleaning
> Emergency Dental
> Dental Exam
> Implants
> Invisalign
> Whitening
> Crowns
> Root Canal
> Children's Dentistry
> Other
>
> For each show:
>
> Leads
> Appointments
> Conversion rate
> Estimated value
>
> Example:
>
> Dental Implants
>
> 14 leads
> 9 appointments
> 64% conversion
> $18,000 estimated opportunity
>
> ==================================================
> 13. MISSED CALL RECOVERY
> ==================================================
>
> This is a major selling point.
>
> Create a dedicated card/section:
>
> MISSED CALL RECOVERY
>
> Display:
>
> 18 missed calls
>
> 7 recovered
>
> 4 appointments booked
>
> $3,600 estimated opportunity recovered
>
> Recovery rate:
>
> 38.9%
>
> CTA:
>
> "View Missed Calls"
>
> CTA:
>
> "Launch Recovery Campaign"
>
> Create a small trend chart showing recovery over time.
>
> ==================================================
> 14. AI INSIGHTS
> ==================================================
>
> Create an AI-powered insight panel.
>
> Title:
>
> AI Business Insights
>
> The system should generate insights such as:
>
> "Missed calls increased by 14% on Mondays between 8 AM and 10 AM."
>
> "Emergency dental inquiries have a 31% higher booking rate than general inquiries."
>
> "7 missed calls were recovered through automated SMS follow-up."
>
> "Implant inquiries generated the highest estimated revenue opportunity this month."
>
> "Appointment cancellations increased 9% compared with the previous period."
>
> Each insight should include:
>
> - severity
> - category
> - explanation
> - recommended action
>
> Categories:
>
> Revenue
> Conversion
> Calls
> Appointments
> Patients
> Marketing
> Operations
>
> Use badges:
>
> Opportunity
> Warning
> Information
> Critical
>
> CTA:
>
> "Ask AI"
>
> ==================================================
> 15. RECENT ACTIVITY
> ==================================================
>
> Create an activity feed.
>
> Examples:
>
> AI receptionist booked a new patient
> 2 minutes ago
>
> Missed call recovered
> 8 minutes ago
>
> Appointment reminder sent
> 15 minutes ago
>
> Patient requested Invisalign consultation
> 23 minutes ago
>
> Review request sent
> 1 hour ago
>
> Outbound recall campaign completed
> 2 hours ago
>
> Each activity should have:
>
> icon
> description
> timestamp
> patient name where appropriate
> status
>
> ==================================================
> 16. UPCOMING APPOINTMENTS
> ==================================================
>
> Create appointment widget.
>
> Columns:
>
> Time
> Patient
> Service
> Type
> Status
>
> Examples:
>
> 9:00 AM
> John Smith
> Cleaning
> New Patient
> Confirmed
>
> 9:30 AM
> Sarah Jones
> Invisalign Consultation
> Existing
> Confirmed
>
> 10:00 AM
> Michael Brown
> Crown
> Existing
> Pending
>
> Statuses:
>
> Confirmed
> Pending
> Cancelled
> No-show
>
> CTA:
>
> "View Calendar"
>
> ==================================================
> 17. OUTBOUND CAMPAIGN PERFORMANCE
> ==================================================
>
> Create a campaign performance widget.
>
> Display:
>
> Campaign name
> Contacts
> Calls
> Answered
> Appointments
> Conversion
> Estimated revenue
>
> Example campaigns:
>
> Overdue Cleaning Recall
> Missed Appointment Recovery
> Implant Follow-up
> Invisalign Follow-up
>
> Provide:
>
> Launch Campaign
>
> button.
>
> ==================================================
> 18. CALLS PAGE
> ==================================================
>
> Route:
>
> /calls
>
> Create a professional call center interface.
>
> Tabs:
>
> All
> Inbound
> Outbound
> Missed
> AI Calls
> Human Calls
>
> Table:
>
> Date
> Caller
> Type
> Duration
> Intent
> Outcome
> Appointment
> AI/Human
> Status
>
> Example:
>
> Aug 10
> John Smith
> Inbound
> 3:42
> New Patient
> Booked
> Yes
> AI
> Completed
>
> ==================================================
> 19. CALL DETAIL PAGE
> ==================================================
>
> Route:
>
> /calls/[id]
>
> Display:
>
> Caller information
>
> Call type
>
> Timestamp
>
> Duration
>
> Outcome
>
> Appointment status
>
> AI confidence
>
> Transcript
>
> Call summary
>
> Detected intent
>
> Detected sentiment
>
> Recommended follow-up
>
> Actions:
>
> Call back
> Send SMS
> Book appointment
> Add note
>
> Transcript should be searchable.
>
> If recording exists:
>
> Provide audio player.
>
> Do not expose sensitive recordings unless authorized.
>
> ==================================================
> 20. PATIENTS PAGE
> ==================================================
>
> Route:
>
> /patients
>
> Table:
>
> Name
> Phone
> Email
> Patient type
> Last appointment
> Next appointment
> Lead source
> Status
> Estimated value
>
> Filters:
>
> New patient
> Existing patient
> High-value lead
> Needs follow-up
> Inactive
> Overdue recall
>
> ==================================================
> 21. PATIENT PROFILE
> ==================================================
>
> Route:
>
> /patients/[id]
>
> Display:
>
> Patient summary
>
> Contact information
>
> Lead source
>
> Conversation history
>
> Call history
>
> Appointments
>
> Campaign history
>
> Notes
>
> AI-generated summary
>
> Example:
>
> "Patient contacted the clinic regarding Invisalign. Asked about financing. No appointment currently booked."
>
> Actions:
>
> Call
> SMS
> Email
> Book appointment
>
> ==================================================
> 22. APPOINTMENTS PAGE
> ==================================================
>
> Route:
>
> /appointments
>
> Provide:
>
> Calendar view
> List view
>
> Filters:
>
> Dentist
> Service
> Status
> New/Existing patient
>
> Appointment statuses:
>
> Requested
> Confirmed
> Completed
> Cancelled
> No-show
>
> Provide:
>
> Book Appointment
>
> button.
>
> ==================================================
> 23. LEADS PAGE
> ==================================================
>
> Route:
>
> /leads
>
> Create Kanban pipeline.
>
> Columns:
>
> New
> Contacted
> Qualified
> Appointment Requested
> Booked
> Completed
> Lost
>
> Each lead card should display:
>
> Name
> Service
> Lead score
> Source
> Estimated value
> Last interaction
> Next action
>
> Allow drag and drop.
>
> ==================================================
> 24. CAMPAIGNS PAGE
> ==================================================
>
> Route:
>
> /campaigns
>
> Display:
>
> Active campaigns
> Completed campaigns
> Scheduled campaigns
>
> Campaign types:
>
> Recall
> Missed Call Recovery
> Appointment Reminder
> Treatment Follow-up
> Review Request
>
> Each campaign displays:
>
> Contacts
> Calls
> SMS
> Responses
> Appointments
> Conversion
> Estimated revenue
>
> CTA:
>
> Create Campaign
>
> ==================================================
> 25. CREATE CAMPAIGN
> ==================================================
>
> Build a guided wizard.
>
> STEP 1:
>
> Select campaign type.
>
> STEP 2:
>
> Define audience.
>
> Examples:
>
> Patients inactive > 6 months
>
> Patients who missed appointments
>
> Implant leads without appointment
>
> Invisalign leads without appointment
>
> STEP 3:
>
> Choose channels:
>
> AI voice
> SMS
> Email
>
> STEP 4:
>
> Define schedule.
>
> STEP 5:
>
> AI generates message/call script.
>
> STEP 6:
>
> Preview.
>
> STEP 7:
>
> Launch.
>
> Before launch, require confirmation.
>
> ==================================================
> 26. AI RECEPTIONIST PAGE
> ==================================================
>
> Route:
>
> /ai-receptionist
>
> Display:
>
> AI status:
>
> ONLINE
>
> Calls today:
>
> 94
>
> Calls handled:
>
> 81
>
> Appointments booked:
>
> 23
>
> Average call duration:
>
> 3m 12s
>
> AI booking conversion:
>
> 28.4%
>
> Create controls:
>
> Enable AI
> Disable AI
> Business hours
> After-hours behavior
> Transfer number
>
> ==================================================
> 27. AI RECEPTIONIST CONFIGURATION
> ==================================================
>
> Allow clinic administrator to configure:
>
> Clinic name
> Address
> Hours
> Phone number
> Emergency policy
> Services
> Insurance information
> Payment options
> Financing information
> Cancellation policy
> Booking rules
> Transfer rules
>
> DO NOT allow the AI to invent medical information.
>
> The knowledge base must be the source of truth for clinic-specific information.
>
> ==================================================
> 28. KNOWLEDGE BASE PAGE
> ==================================================
>
> Route:
>
> /knowledge-base
>
> Allow upload of:
>
> PDF
> DOCX
> TXT
> CSV
>
> Categories:
>
> Clinic Policies
> Services
> Insurance
> Pricing
> FAQs
> Emergency Procedures
> Patient Instructions
>
> Display:
>
> Document
> Category
> Upload date
> Status
> Chunks
> Indexed
>
> Actions:
>
> Upload
> Delete
> Re-index
> View
>
> The n8n ingestion workflow will process documents.
>
> ==================================================
> 29. ANALYTICS PAGE
> ==================================================
>
> Route:
>
> /analytics
>
> Create advanced analytics.
>
> Metrics:
>
> Call volume
> Answer rate
> Missed call rate
> Lead conversion
> Appointment conversion
> No-show rate
> Cancellation rate
> Recall conversion
> Campaign ROI
> Estimated revenue
>
> Charts:
>
> Call volume
> Conversion trends
> Service performance
> Lead sources
> Campaign performance
>
> Provide filters:
>
> Date
> Service
> Campaign
> Source
> Dentist
>
> ==================================================
> 30. REPORTS PAGE
> ==================================================
>
> Route:
>
> /reports
>
> Display:
>
> Daily report
> Weekly report
> Monthly report
>
> AI-generated report example:
>
> Executive Summary
>
> "Your clinic received 247 calls this month, generated 86 qualified inquiries, and booked 64 appointments."
>
> Key opportunities
>
> 1. Improve Monday call coverage.
> 2. Follow up with 11 unbooked implant leads.
> 3. Reactivate 37 overdue hygiene patients.
>
> Allow:
>
> Generate Report
> Download PDF
> Email Report
>
> ==================================================
> 31. SETTINGS
> ==================================================
>
> Create:
>
> /settings
>
> Sections:
>
> Clinic Profile
> Users
> Roles
> Phone
> AI Receptionist
> Calendar
> SMS
> Email
> Knowledge Base
> Notifications
> Billing
> Security
>
> ==================================================
> 32. SUPABASE DATABASE
> ==================================================
>
> Create database-ready TypeScript interfaces and service functions.
>
> Minimum tables:
>
> organizations
> users
> patients
> leads
> calls
> call_transcripts
> appointments
> services
> campaigns
> campaign_contacts
> messages
> conversations
> documents
> document_chunks
> ai_insights
> notifications
> activity_logs
>
> All tables must include:
>
> id
> organization_id
> created_at
> updated_at
>
> Use UUIDs.
>
> Create appropriate indexes.
>
> IMPORTANT:
> Implement Row Level Security so users can only access records belonging to their organization.
>
> ==================================================
> 33. CALL DATA MODEL
> ==================================================
>
> calls:
>
> id
> organization_id
> patient_id
> lead_id
> direction
> phone_number
> started_at
> ended_at
> duration_seconds
> status
> intent
> outcome
> ai_handled
> appointment_id
> recording_url
> transcript_id
> sentiment
> created_at
>
> direction:
>
> inbound
> outbound
>
> status:
>
> completed
> missed
> failed
> transferred
>
> ==================================================
> 34. LEAD DATA MODEL
> ==================================================
>
> leads:
>
> id
> organization_id
> patient_id
> source
> service
> status
> lead_score
> estimated_value
> priority
> first_contact_at
> last_contact_at
> appointment_id
> assigned_to
> created_at
> updated_at
>
> ==================================================
> 35. AI INSIGHTS DATA MODEL
> ==================================================
>
> ai_insights:
>
> id
> organization_id
> category
> severity
> title
> description
> recommendation
> metric
> metric_value
> status
> created_at
>
> ==================================================
> 36. MOCK DATA
> ==================================================
>
> During initial UI development, create realistic mock data.
>
> Do NOT use random lorem ipsum.
>
> Use realistic dental clinic information.
>
> Example clinic:
>
> Maple Grove Dental Clinic
>
> Location:
> Mississauga, Ontario
>
> Services:
>
> General Dentistry
> Emergency Dentistry
> Dental Implants
> Invisalign
> Whitening
> Crowns
> Root Canal
> Children's Dentistry
>
> Generate realistic call and appointment data.
>
> Clearly separate:
>
> /mock
>
> from:
>
> /services
>
> The dashboard must be switchable from mock data to Supabase data without rewriting UI components.
>
> ==================================================
> 37. API ABSTRACTION
> ==================================================
>
> Create service functions such as:
>
> getDashboardMetrics()
> getCallMetrics()
> getRecentCalls()
> getUpcomingAppointments()
> getLeadFunnel()
> getCampaignPerformance()
> getAIInsights()
> getMissedCallRecovery()
> getPatient()
> getPatients()
> getAppointments()
> getCalls()
>
> Do not query Supabase directly from visual components.
>
> ==================================================
> 38. N8N INTEGRATION
> ==================================================
>
> Prepare frontend/backend interfaces for n8n.
>
> n8n workflows will eventually handle:
>
> 1. inbound calls
> 2. outbound calls
> 3. missed call recovery
> 4. appointment reminders
> 5. appointment booking
> 6. recall campaigns
> 7. treatment follow-up
> 8. review requests
> 9. AI insights
> 10. daily reports
>
> Create API/event contracts.
>
> Example event:
>
> POST /api/events
>
> {
>   "event_name": "lead.created",
>   "organization_id": "uuid",
>   "payload": {}
> }
>
> Supported events:
>
> lead.created
> lead.qualified
> call.started
> call.completed
> call.missed
> appointment.created
> appointment.confirmed
> appointment.cancelled
> appointment.completed
> patient.created
> campaign.started
> campaign.completed
> review.requested
>
> ==================================================
> 39. DESIGN SYSTEM
> ==================================================
>
> The dashboard should look premium.
>
> Design direction:
>
> Modern healthcare SaaS + enterprise analytics.
>
> Use:
>
> White/light background by default.
>
> Dark sidebar.
>
> Subtle borders.
>
> Rounded cards.
>
> Professional typography.
>
> Minimal gradients.
>
> Use color only where it communicates status.
>
> Status colors:
>
> Success
> Warning
> Danger
> Information
>
> Avoid excessive visual effects.
>
> Do not make the application look like a gaming dashboard.
>
> ==================================================
> 40. RESPONSIVENESS
> ==================================================
>
> Desktop:
> optimized for 1440px and above.
>
> Laptop:
> optimized for 1280px.
>
> Tablet:
> responsive.
>
> Mobile:
> functional but dashboard-first features may collapse into cards.
>
> Tables should become horizontally scrollable or responsive cards.
>
> ==================================================
> 41. ACCESSIBILITY
> ==================================================
>
> Implement:
>
> Keyboard navigation
> ARIA labels
> Focus states
> Accessible dialogs
> Accessible forms
> Color contrast
> Screen-reader-friendly labels
>
> ==================================================
> 42. ERROR HANDLING
> ==================================================
>
> Every page needs:
>
> Loading state
> Error state
> Empty state
>
> Examples:
>
> "No calls found for this period."
>
> "No campaigns are currently active."
>
> "No AI insights are available yet."
>
> ==================================================
> 43. SECURITY / PRIVACY
> ==================================================
>
> This application will process sensitive patient information.
>
> Design the system with privacy and security as first-class requirements.
>
> Never:
>
> - expose patient data publicly
> - place sensitive patient information in frontend source code
> - log unnecessary patient information
> - expose API keys
> - expose OpenAI keys
> - expose Twilio credentials
>
> Use environment variables.
>
> Prepare architecture for appropriate Canadian privacy compliance and clinic security requirements.
>
> Do not claim regulatory compliance unless it has actually been implemented and independently verified.
>
> ==================================================
> 44. AI SAFETY
> ==================================================
>
> The AI receptionist is NOT a dentist.
>
> It must not:
>
> - diagnose patients
> - prescribe medication
> - provide definitive medical advice
> - invent treatment recommendations
> - invent insurance coverage
> - invent pricing
>
> For medical emergencies:
>
> The system should follow the clinic's configured emergency policy and escalate appropriately.
>
> For uncertain questions:
>
> "Let me connect you with a member of our dental team."
>
> ==================================================
> 45. DASHBOARD UX PRIORITY
> ==================================================
>
> The first screen should immediately communicate:
>
> CALLS
> LEADS
> APPOINTMENTS
> MISSED CALLS
> CONVERSION
> REVENUE OPPORTUNITY
>
> The clinic owner should understand the business situation within 10 seconds.
>
> Use progressive disclosure.
>
> Do not overload the dashboard with every possible metric.
>
> ==================================================
> 46. IMPORTANT MVP PRIORITY
> ==================================================
>
> Do NOT spend time building:
>
> - complex billing
> - advanced predictive analytics
> - complex CRM
> - complicated marketing automation
> - enterprise admin functionality
>
> for the first iteration.
>
> Prioritize:
>
> 1. Dashboard
> 2. Calls
> 3. Leads
> 4. Appointments
> 5. AI receptionist
> 6. Missed-call recovery
> 7. Campaigns
> 8. AI insights
>
> ==================================================
> 47. DEMO MODE
> ==================================================
>
> Create a Demo Mode.
>
> A user should be able to open the application and see a fully populated example dental clinic without connecting Supabase.
>
> Provide:
>
> "Demo Clinic"
>
> with realistic data.
>
> Include a toggle:
>
> Demo Mode
> Live Mode
>
> Demo Mode should never write data to production Supabase.
>
> ==================================================
> 48. CODE QUALITY
> ==================================================
>
> Use:
>
> TypeScript strict mode.
>
> Avoid:
>
> any
>
> unless absolutely necessary.
>
> Use reusable types.
>
> Use Zod for validation.
>
> Use React Query for server state.
>
> Use Zustand only where appropriate.
>
> Use modular components.
>
> Document non-obvious logic.
>
> Create clean naming conventions.
>
> ==================================================
> 49. TESTING
> ==================================================
>
> Create:
>
> Unit tests
> Integration tests
> Basic E2E tests
>
> At minimum test:
>
> Dashboard metrics
> Lead creation
> Call display
> Appointment display
> Date filtering
> Organization isolation
> Role permissions
>
> ==================================================
> 50. DELIVERABLES
> ==================================================
>
> Build the application in stages.
>
> STAGE 1:
> Create project architecture.
>
> STAGE 2:
> Create design system.
>
> STAGE 3:
> Create navigation/layout.
>
> STAGE 4:
> Create Dashboard.
>
> STAGE 5:
> Create Calls.
>
> STAGE 6:
> Create Leads.
>
> STAGE 7:
> Create Appointments.
>
> STAGE 8:
> Create Campaigns.
>
> STAGE 9:
> Create AI Receptionist.
>
> STAGE 10:
> Create Knowledge Base.
>
> STAGE 11:
> Create Analytics.
>
> STAGE 12:
> Create Reports.
>
> STAGE 13:
> Create Settings.
>
> STAGE 14:
> Connect Supabase.
>
> STAGE 15:
> Connect n8n event endpoints.
>
> STAGE 16:
> Testing and production hardening.
>
> After completing each stage:
>
> 1. Run the application.
> 2. Check TypeScript errors.
> 3. Check lint errors.
> 4. Fix errors.
> 5. Verify responsive behavior.
> 6. Do not move to the next stage until the current stage is functional.
>
> DO NOT rewrite working components unnecessarily.
>
> ==================================================
> 51. FINAL PRODUCT EXPERIENCE
> ==================================================
>
> When a clinic owner logs in, the experience should feel like:
>
> "I have an AI employee monitoring my front desk and patient acquisition."
>
> The dashboard should answer:
>
> How many people contacted us?
>
> How many calls did we miss?
>
> How many patients did AI recover?
>
> How many appointments were booked?
>
> Which services are generating the most opportunities?
>
> Which patients need follow-up?
>
> How much revenue opportunity exists?
>
> What should we do next?
>
> The product must feel commercially viable, not like a developer prototype.
>
> START BY:
> 1. Inspecting the existing repository.
> 2. Identifying the current framework and dependencies.
> 3. Do not replace the existing stack unless necessary.
> 4. Create a concise implementation plan.
> 5. Implement the architecture and dashboard foundation first.
> 6. Then proceed incrementally through the MVP stages above.
