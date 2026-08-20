import { describe, it, expect } from 'vitest';
import { reminderEmail } from './lineup-reminders';

// Only reminderEmail is imported so this file never pulls in mssql or resend
// at runtime; it is the one pure piece of a module that otherwise touches
// the DB and an email API.

describe('reminderEmail', () => {
  const base = { week: 4, teamName: 'Pin Pals', captainName: 'Sam' };

  it('reminder pass has the plain subject', () => {
    const { subject } = reminderEmail({ pass: 'reminder', ...base });
    expect(subject).toBe('Lineup Reminder - Week 4');
  });

  it('lastcall pass has the urgent subject', () => {
    const { subject } = reminderEmail({ pass: 'lastcall', ...base });
    expect(subject).toBe('Last call - Week 4 lineup needed today');
  });

  it('the two passes produce different bodies', () => {
    const reminder = reminderEmail({ pass: 'reminder', ...base });
    const lastcall = reminderEmail({ pass: 'lastcall', ...base });
    expect(reminder.html).not.toBe(lastcall.html);
  });

  it('lastcall body mentions scoresheets printing this afternoon', () => {
    const { html } = reminderEmail({ pass: 'lastcall', ...base });
    expect(html).toContain('scoresheets this afternoon');
  });

  it('reminder body contains the team name in a <strong> tag', () => {
    const { html } = reminderEmail({ pass: 'reminder', ...base });
    expect(html).toContain('<strong>Pin Pals</strong>');
  });

  it('both bodies contain the captain name in the greeting', () => {
    const reminder = reminderEmail({ pass: 'reminder', ...base });
    const lastcall = reminderEmail({ pass: 'lastcall', ...base });
    expect(reminder.html).toContain('Hey Sam!');
    expect(lastcall.html).toContain('Hey Sam!');
  });

  it('both link to the lineup page', () => {
    const reminder = reminderEmail({ pass: 'reminder', ...base });
    const lastcall = reminderEmail({ pass: 'lastcall', ...base });
    expect(reminder.html).toContain('https://splitzkrieg.com/lineup');
    expect(lastcall.html).toContain('https://splitzkrieg.com/lineup');
  });

  it('passes captainName through verbatim; the "Captain" fallback is the caller\'s job', () => {
    const { html } = reminderEmail({ ...base, pass: 'reminder', captainName: 'Captain' });
    expect(html).toContain('Hey Captain!');
  });
});
