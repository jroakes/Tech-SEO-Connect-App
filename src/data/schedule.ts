// Bundled schedule, used until the hourly sync has filled the sessions table
// in D1 (and as a fallback if D1 is unavailable). A copy of the 2026 schedule
// as synced from www.techseoconnect.com on 2026-10-29.
import type { SessionInput } from "@/lib/types";
import { assignSessionIds } from "@/lib/sessions";

const schedule: SessionInput[] = [
  { time: "5:00 PM", title: "Welcome Drinks", duration: 120, isBreak: true, day: 1, date: "2026-11-04", description: "At SO/IF Bar in downtown Durham" },
  { time: "7:00 PM", title: "Welcome Party", duration: 180, isBreak: true, day: 1, date: "2026-11-04", description: "At Mateo Tapas (full restaurant buyout) Hosted by The SEO Community and Noah Learner" },
  { time: "8:00 AM", title: "Check-In and Registration", duration: 50, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "8:50 AM", title: "Welcome Remarks", duration: 10, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "9:00 AM", title: "Solid Ground: What AI Agents Stand On, and Why It Shifts", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Krishna Madhavan" },
  { time: "9:30 AM", title: "Talk Title to Be Announced", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Vivan Marwaha" },
  { time: "10:00 AM", title: "Networking Break", duration: 30, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "10:30 AM", title: "When Server Logs Lie: The Wire-Level Truth Behind Googlebot’s Ghost Errors", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Jori Ford" },
  { time: "11:00 AM", title: "The Philosophy Minor’s Guide to Log Files", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Jamie Indigo" },
  { time: "11:30 AM", title: "Lunch", duration: 90, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "1:00 PM", title: "Evergreen Crawl: See Your Site Exactly as Googlebot Saw It", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Serge Bezborodov" },
  { time: "1:30 PM", title: "What I've Learned Doing Over 100 Website Replatformings and Migrations", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Zach Chahalis" },
  { time: "2:00 PM", title: "Networking Break", duration: 30, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "2:30 PM", title: "Video SEO to Super-Charge AIO Visibility", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Cindy Krum" },
  { time: "3:00 PM", title: "Brand Visibility Reporting When No Single Data Source Covers It", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Savannah Casto" },
  { time: "3:30 PM", title: "Networking Break", duration: 30, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "4:00 PM", title: "Why Google Is Taking Aggressive Action on SERP Data Collection and What to Do About It", duration: 30, isBreak: false, day: 2, date: "2026-11-05", speaker: "Ray Grieselhuber" },
  { time: "4:30 PM", title: "Farewell Remarks", duration: 30, isBreak: true, day: 2, date: "2026-11-05" },
  { time: "5:00 PM", title: "Happy Hour", duration: 120, isBreak: true, day: 2, date: "2026-11-05", description: "We’ll be serving drinks from a 1930s-era rail car right in the heart of American Tobacco Campus. Live jazz from Butler Knowles and friends. Beer and wine from delafia. English muffin personal pizzas from Redstart Foods" },
  { time: "9:00 PM", title: "After Party", duration: 300, isBreak: true, day: 2, date: "2026-11-05", description: "At BOOM Club in Durham SEO and DJ Lily Ray, alongside Ash Lauryn, LexOnLoud and thefacesblur Free with your conference badge No separate ticket needed View the event on Instagram" },
  { time: "8:00 AM", title: "Coffee and Networking", duration: 50, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "8:50 AM", title: "Welcome Remarks", duration: 10, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "9:00 AM", title: "The FACTS Leaderboard: Measuring Model Factuality", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Anfal Siddiqui" },
  { time: "9:30 AM", title: "Technical SEO in the AI Search Era in 2026: The Shifts, Trends and What to Do About Them", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Aleyda Solís" },
  { time: "10:00 AM", title: "Networking Break", duration: 30, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "10:30 AM", title: "Reciprocal Rank Fusion: How a Query’s Intents Collaborate to Build an Answer", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "JP Sherman" },
  { time: "11:00 AM", title: "The Leaked ChatGPT Ranking Stack: How OpenAI Scores Every Webpage", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Metehan Yesilyurt" },
  { time: "11:30 AM", title: "Lunch", duration: 90, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "1:00 PM", title: "It Works on My Data: Dev Habits for SEOs Who Code With AI", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Sam Torres" },
  { time: "1:30 PM", title: "I Can't Code. Here's How I Built Our Entire Client Intelligence System Anyway", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "David Bell" },
  { time: "2:00 PM", title: "Networking Break", duration: 30, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "2:30 PM", title: "AI Bots on Your Site: What They See, Why It Matters, and Where to Draw the Line", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Lauren Green" },
  { time: "3:00 PM", title: "AI and the Rise of the Agentic Web", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Darwin Santos", description: "Technical SEO for a Web That Answers and Acts" },
  { time: "3:30 PM", title: "Networking Break", duration: 30, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "4:00 PM", title: "SEOs Don’t Actually Do Marketing and It Shows", duration: 30, isBreak: false, day: 3, date: "2026-11-06", speaker: "Michael King" },
  { time: "4:30 PM", title: "Farewell Remarks", duration: 30, isBreak: true, day: 3, date: "2026-11-06" },
  { time: "5:00 PM", title: "Farewell Party", duration: 420, isBreak: true, day: 3, date: "2026-11-06", description: "At delafia 1103 S Roxboro St, Durham, NC 27707 Google Maps Tacos from Taqueria La Vaquita from 6 to 8 PM Live jazz from Butler Knowles and friends from 7 to 10 PM Free with your conference badge No separate ticket needed" },
];

export const fallbackSchedule = assignSessionIds(schedule);
