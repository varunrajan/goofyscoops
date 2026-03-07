# 🐶 Project GoofyScoops: PRD (v1.1 - Supabase Integrated)
# 1\. Project Overview
A mobile-first, goofy-themed tracker for a pet's daily intake.
* **Goal:** Allow two people sharing one account to track kibble, supplements, and meds in real-time.
* **Tech Stack:** Next.js (App Router), Tailwind CSS, Supabase (Auth + Database), Lucide-React.
* **Key Behavior:** Single-hand "tap-to-track" interface with optimistic UI updates.

⠀
# 2\. Database Schema (Supabase/PostgreSQL)
*Note: This will be executed via SQL migration in the Supabase dashboard.*
### Tables:
**1** **profiles**: Links to Supabase Auth.
	* id (uuid, pk), household_id (uuid).
**2** **pets**:
	* id (uuid, pk), name (text), household_id (uuid).
**3** **settings**: (One per pet)
	* pet_id (uuid, fk), meal_type (text), scoop_size (text), daily_scoops (int), supplements_config (jsonb), meds_config (jsonb).
**4** **daily_logs**: (Row per pet per day)
	* id (uuid, pk), pet_id (uuid, fk), date (date), kibble_checked (int), supplements_status (jsonb), meds_status (jsonb).

⠀
# 3\. Core Functional Requirements
### A. Authentication
* **Login Page:** A playful "Who's a good boy?" login screen.
* **Access:** Use Supabase Auth (Email/Password).
* **Middleware:** Protect all routes; redirect unauthenticated users to /login.

⠀B. Dashboard (Home)
* **Real-time Kibble Tracker:** * Fetch kibble_checked and daily_scoops from database.
  * Render circles based on daily_scoops.
  * **Logic:** Tapping a circle triggers a Supabase upsert to daily_logs.
* **Dynamic Supplements/Meds:** * Rendered based on the supplements_config array in the settings table.
  * Checked status stored in daily_logs.supplements_status (map of ID to count).

⠀C. Settings (Configuration)
* **Meal Setup:** * Select Scoop Size (0, 1/4, 1/3, 1/2, 2/3, 3/4, 1).
  * Select Number of Scoops (Integer).
* **Supps/Meds CRUD:** * Ability to add "Allergy Pill" with a "2 times per day" frequency.
  * This updates the settings table, which immediately changes the number of circles on the Dashboard.

⠀
# 4\. UI/UX Design System (Tailwind)
* **Vibe:** Goofy, rounded, high-contrast.
* **Palette:**
  * Background: #FCF6EC (Cream)
  * Circles (Checked): #FFD166 (Yellow)
  * Circles (Empty): Transparent with #00A896 (Teal) border.
* **Interactive:** Use framer-motion for a "squish" effect when circles are tapped.
