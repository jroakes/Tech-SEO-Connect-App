import type { ScheduleSession } from "@shared/schema";

export const scheduleDay1: ScheduleSession[] = [
  { time: "8:00 AM", title: "Registration & Coffee", duration: 60, isBreak: true, day: 1 },
  { time: "9:00 AM", title: "Announcements / Intro", duration: 10, isBreak: false, day: 1 },
  { time: "9:10 AM", title: "Speaker 1", duration: 30, isBreak: false, day: 1 },
  { time: "9:40 AM", title: "Speaker 2", duration: 30, isBreak: false, day: 1 },
  { time: "10:10 AM", title: "Morning Break", duration: 30, isBreak: true, day: 1 },
  { time: "10:40 AM", title: "Speaker 3", duration: 30, isBreak: false, day: 1 },
  { time: "11:10 AM", title: "Speaker 4", duration: 30, isBreak: false, day: 1 },
  { time: "11:40 AM", title: "Speaker 5", duration: 30, isBreak: false, day: 1 },
  { time: "12:10 PM", title: "Lunch", duration: 90, isBreak: true, day: 1 },
  { time: "1:40 PM", title: "Speaker 6", duration: 30, isBreak: false, day: 1 },
  { time: "2:10 PM", title: "Speaker 7", duration: 30, isBreak: false, day: 1 },
  { time: "2:40 PM", title: "Speaker 8", duration: 30, isBreak: false, day: 1 },
  { time: "3:10 PM", title: "Afternoon Break", duration: 30, isBreak: true, day: 1 },
  { time: "3:40 PM", title: "Speaker 9", duration: 30, isBreak: false, day: 1 },
  { time: "4:10 PM", title: "Speaker 10", duration: 30, isBreak: false, day: 1 },
  { time: "4:40 PM", title: "Closing Remarks", duration: 15, isBreak: false, day: 1 },
];

export const scheduleDay2: ScheduleSession[] = [
  { time: "8:00 AM", title: "Registration & Coffee", duration: 60, isBreak: true, day: 2 },
  { time: "9:00 AM", title: "Announcements / Intro", duration: 10, isBreak: false, day: 2 },
  { time: "9:10 AM", title: "Speaker 1", duration: 30, isBreak: false, day: 2 },
  { time: "9:40 AM", title: "Speaker 2", duration: 30, isBreak: false, day: 2 },
  { time: "10:10 AM", title: "Morning Break", duration: 30, isBreak: true, day: 2 },
  { time: "10:40 AM", title: "Speaker 3", duration: 30, isBreak: false, day: 2 },
  { time: "11:10 AM", title: "Speaker 4", duration: 30, isBreak: false, day: 2 },
  { time: "11:40 AM", title: "Speaker 5", duration: 30, isBreak: false, day: 2 },
  { time: "12:10 PM", title: "Lunch", duration: 90, isBreak: true, day: 2 },
  { time: "1:40 PM", title: "Speaker 6", duration: 30, isBreak: false, day: 2 },
  { time: "2:10 PM", title: "Speaker 7", duration: 30, isBreak: false, day: 2 },
  { time: "2:40 PM", title: "Speaker 8", duration: 30, isBreak: false, day: 2 },
  { time: "3:10 PM", title: "Afternoon Break", duration: 30, isBreak: true, day: 2 },
  { time: "3:40 PM", title: "Speaker 9", duration: 30, isBreak: false, day: 2 },
  { time: "4:10 PM", title: "Speaker 10", duration: 30, isBreak: false, day: 2 },
  { time: "4:40 PM", title: "Closing Remarks", duration: 15, isBreak: false, day: 2 },
];

export const allScheduleSessions = [...scheduleDay1, ...scheduleDay2];
