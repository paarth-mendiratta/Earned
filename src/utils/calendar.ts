/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalendarEvent } from '../types';

// Fetch the user's upcoming primary calendar events for today and tomorrow
export async function fetchCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    
    // Get events for the next 7 days
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + 7);
    const timeMax = endOfWeek.toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

    console.group('[Google Calendar API Debugger]');
    console.log(`[1] API Fetch Initiated. Querying PRIMARY calendar.`);
    console.log(`[2] Query Range (Next 7 Days):`);
    console.log(`    - Start Time (timeMin): ${timeMin} (${now.toLocaleString()})`);
    console.log(`    - End Time (timeMax):   ${timeMax} (${endOfWeek.toLocaleString()})`);
    console.log(`[3] Target Request URL: ${url}`);
    console.log(`[4] Token Presence: Access token of length ${accessToken?.length || 0} is present.`);
    console.groupEnd();

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Google Calendar API Error Detail]:', {
        status: res.status,
        statusText: res.statusText,
        url: url,
        responseBody: errText
      });
      throw new Error(`Failed to fetch events: ${res.statusText}`);
    }

    const data = await res.json();
    
    console.group('[Google Calendar API Raw Response]');
    console.log('Status Code: 200 OK');
    console.log('Full JSON Payload:', data);
    console.log('Raw Events Count:', data.items?.length || 0);
    if (data.items && data.items.length > 0) {
      console.log('Sample Event Item[0]:', data.items[0]);
    } else {
      console.log('NOTICE: No items found in response payload in this time range. The list is empty.');
    }
    console.groupEnd();

    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || 'Untitled Event',
      start: {
        dateTime: item.start?.dateTime || item.start?.date || '',
        timeZone: item.start?.timeZone,
      },
      end: {
        dateTime: item.end?.dateTime || item.end?.date || '',
        timeZone: item.end?.timeZone,
      },
      description: item.description,
    }));
  } catch (error) {
    console.error('[Google Calendar API Error Trace]:', error);
    throw error;
  }
}

// Create an event on the user's primary Google Calendar (requires explicit approval in the UI first!)
export async function createCalendarEvent(
  accessToken: string,
  summary: string,
  description: string,
  startIso: string,
  endIso: string
): Promise<any> {
  try {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const body = {
      summary,
      description: `${description}\n\n[Synced by Earned AI Companion]`,
      start: {
        dateTime: startIso,
      },
      end: {
        dateTime: endIso,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Calendar API insert error:', errText);
      throw new Error(`Failed to create event: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error('createCalendarEvent Error:', error);
    throw error;
  }
}
