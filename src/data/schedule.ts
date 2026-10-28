// Bundled schedule, used until the hourly sync has filled the sessions table
// in D1 (and as a fallback if D1 is unavailable). Still the 2025 schedule.
import type { SessionInput } from "@/lib/types";
import { assignSessionIds } from "@/lib/sessions";
import { event } from "./event";

const scheduleDay1: SessionInput[] = [
  { time: "8:00 AM", title: "Registration, Coffee, & Networking", duration: 50, isBreak: true, day: 1 },
  { time: "8:50 AM", title: "Conference Intro", duration: 10, isBreak: true, day: 1 },
  { time: "9:00 AM", title: "Beyond Blue Links: Freshness, Control, and Visibility", duration: 30, isBreak: false, day: 1, speaker: "Krishna Madhavan" },
  { time: "9:30 AM", title: "Beyond Googlebot: Evidence-Based Retrieval Experiments with AI Crawlers", duration: 30, isBreak: false, day: 1, speaker: "Jori Ford" },
  { time: "10:00 AM", title: "Morning Networking Break", duration: 30, isBreak: true, day: 1 },
  { time: "10:30 AM", title: "Trashchat's Guide to Black Boxes: Technical SEO Tactics for LLMs", duration: 30, isBreak: false, day: 1, speaker: "Jamie Indigo" },
  { time: "11:00 AM", title: "Should We Do This Yet? Clear Advice On 5 High-Impact Technical SEO Decisions", duration: 30, isBreak: false, day: 1, speaker: "Alex Halliday" },
  { time: "11:30 AM", title: "Lunch", duration: 90, isBreak: true, day: 1 },
  { time: "1:00 PM", title: "From Schema Markup to Knowledge Graphs: Powering AI with Connected Data", duration: 30, isBreak: false, day: 1, speaker: "Martha van Berkel" },
  { time: "1:30 PM", title: "AI Internal Linking for E-Commerce Websites", duration: 30, isBreak: false, day: 1, speaker: "Serge Bezborodov" },
  { time: "2:00 PM", title: "Afternoon Networking Break", duration: 30, isBreak: true, day: 1 },
  { time: "2:30 PM", title: "Decision Intelligence for Enterprise SEO", duration: 30, isBreak: false, day: 1, speaker: "Tyler Gargula" },
  { time: "3:00 PM", title: "From Guesswork to Growth: Building an SEO Strategy That Compounds", duration: 30, isBreak: false, day: 1, speaker: "Brie Anderson" },
  { time: "3:30 PM", title: "Afternoon Networking Break", duration: 30, isBreak: true, day: 1 },
  { time: "4:00 PM", title: "Behind the Scenes of Building Scalable Data Products for SEOs", duration: 30, isBreak: false, day: 1, speaker: "Baruch Toledano" },
  { time: "4:30 PM", title: "Video SEO – The Shortcut to AIO Visibility", duration: 30, isBreak: false, day: 1, speaker: "Cindy Krum" },
  { time: "5:00 PM", title: "Closing Remarks", duration: 10, isBreak: true, day: 1 },
  { time: "5:10 PM", title: "Happy Hour at Club Era", duration: 120, isBreak: true, day: 1 },
];

const scheduleDay2: SessionInput[] = [
  { time: "8:00 AM", title: "Registration, Coffee, & Networking", duration: 50, isBreak: true, day: 2 },
  { time: "8:50 AM", title: "Announcements / Intro", duration: 10, isBreak: true, day: 2 },
  { time: "9:00 AM", title: "Everything You MFs Should Know About Query Fan Out", duration: 30, isBreak: false, day: 2, speaker: "Michael King" },
  { time: "9:30 AM", title: "We Analyzed 250,000,000 AI Search Responses: Here's What We Found", duration: 30, isBreak: false, day: 2, speaker: "Josh Blyskal" },
  { time: "10:00 AM", title: "Morning Networking Break", duration: 30, isBreak: true, day: 2 },
  { time: "10:30 AM", title: "From Deck to Dev: Getting SEO Recommendations Shipped at Enterprise Scale", duration: 30, isBreak: false, day: 2, speaker: "Ross Hudgens" },
  { time: "11:00 AM", title: "Growth Systems: How IBM Turned One Organic Success Into Ten", duration: 30, isBreak: false, day: 2, speaker: "Bryan Casey" },
  { time: "11:30 AM", title: "Lunch", duration: 90, isBreak: true, day: 2 },
  { time: "1:00 PM", title: "The Secret to Enterprise Crawl Optimization: SRE", duration: 30, isBreak: false, day: 2, speaker: "Rachel Anderson" },
  { time: "1:30 PM", title: "Rendering, Style, and Layout When Things Go Wrong", duration: 30, isBreak: false, day: 2, speaker: "Giacomo Zecchini" },
  { time: "2:00 PM", title: "Afternoon Networking Break", duration: 30, isBreak: true, day: 2 },
  { time: "2:30 PM", title: "Using GA4 to Surface Technical SEO Issues In Real-Time", duration: 30, isBreak: false, day: 2, speaker: "Dana DiTomaso" },
  { time: "3:00 PM", title: "When Traffic Gets Weird: ML for Anomalies & Forecasts", duration: 30, isBreak: false, day: 2, speaker: "Sam Torres" },
  { time: "3:30 PM", title: "Afternoon Networking Break", duration: 30, isBreak: true, day: 2 },
  { time: "4:00 PM", title: "The Pitfalls of Following Frameworks", duration: 30, isBreak: false, day: 2, speaker: "Jess Joyce" },
  { time: "4:30 PM", title: "Stacking Signals: How International SEO Comes Together (And Falls Apart)", duration: 30, isBreak: false, day: 2, speaker: "Max Prin" },
  { time: "5:00 PM", title: "Closing Remarks", duration: 10, isBreak: true, day: 2 },
  { time: "5:10 PM", title: "Happy Hour at The Fruit", duration: 120, isBreak: true, day: 2 },
];

const dateOf = (day: number) => event.days.find((d) => d.day === day)?.date;

export const fallbackSchedule = assignSessionIds(
  [...scheduleDay1, ...scheduleDay2].map((s) => ({ ...s, date: dateOf(s.day) })),
);
