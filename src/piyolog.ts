export enum Language {
  Japanese = 'ja',
  English = 'en',
  Unknown = ''
}

enum Section {
  Date = 1,
  Baby,
  Logs,
  Results,
  Journal,
  End
}

const PIYOLOG_JA = '【ぴよログ】';
const PIYOLOG_EN = '[PiyoLog]';
const PIYOLOG_SEPARATOR = '----------';

// Default timezone for PiyoLog (Asia/Tokyo)
let piyoTimezone = 'Asia/Tokyo';

export function setTimezone(tz: string): void {
  piyoTimezone = tz;
}

export interface Data {
  tag: Language;
  entries: Entry[];
}

export interface Entry {
  date: Date;
  baby?: Baby;
  logs: Log[];
  results: string[];
  journal: string;
}

export interface Baby {
  name: string;
  dateOfBirth: Date;
}

export interface Log {
  type: string;
  content: string;
  notes?: string;
  createdAt: Date;
}

class EntryBuilder {
  private section: Section = Section.Date;
  public date: Date;
  public baby?: Baby;
  public logs: Log[] = [];
  public results: string[] = [];
  public journal: string = '';

  constructor(date: Date) {
    this.date = date;
  }

  private nextSection(): Section {
    switch (this.section) {
      case Section.Date:
        this.section = Section.Baby;
        break;
      case Section.Baby:
        this.section = Section.Logs;
        break;
      case Section.Logs:
        this.section = Section.Results;
        break;
      case Section.Results:
        this.section = Section.Journal;
        break;
      case Section.Journal:
        this.section = Section.End;
        break;
    }
    return this.section;
  }

  private endSection(): void {
    this.section = Section.End;
  }

  public apply(line: string): void {
    switch (this.section) {
      case Section.Date:
        this.nextSection();
        this.apply(line);
        break;
      
      case Section.Baby:
        if (line === '') {
          return;
        }
        const babyMatch = line.match(/^(.*) \(([0-9]+)(歳|y)([0-9]+)(か月|m)([0-9]+)(日|d)\)$/);
        if (babyMatch) {
          this.baby = this.newBaby(line);
          this.nextSection();
          return;
        }
        // if text doesn't contain baby information, move to the next section
        this.section = Section.Logs;
        this.apply(line);
        break;
      
      case Section.Logs:
        if (line === '' && this.logs.length > 0) {
          this.nextSection();
          return;
        }
        const logMatch = line.match(/^([0-9:]{5} ?(AM|PM)?)/);
        if (logMatch) {
          const log = newLog(line, this.date);
          if (log) {
            this.logs.push(log);
          }
          return;
        }
        break;
      
      case Section.Results:
        if (line === '' && this.results.length > 0) {
          this.section = Section.Journal;
          return;
        }
        this.results.push(line);
        break;
      
      case Section.Journal:
        if (this.journal === '') {
          this.journal = line;
        } else {
          this.journal = `${this.journal}\n${line}`;
        }
        break;
    }
  }

  private newBaby(str: string): Baby {
    const matches = str.match(/^(.*) \(([0-9]+)(歳|y)([0-9]+)(か月|m)([0-9]+)(日|d)\)$/);
    if (!matches) {
      throw new Error('Invalid baby format');
    }
    
    const years = parseInt(matches[2], 10);
    const months = parseInt(matches[4], 10);
    const days = parseInt(matches[6], 10);
    
    const dateOfBirth = new Date(this.date);
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - years);
    dateOfBirth.setMonth(dateOfBirth.getMonth() - months);
    dateOfBirth.setDate(dateOfBirth.getDate() - days);
    
    return {
      name: matches[1],
      dateOfBirth
    };
  }

  public build(): Entry {
    this.endSection();
    return {
      date: this.date,
      baby: this.baby,
      logs: this.logs,
      results: this.results,
      journal: this.journal
    };
  }
}

function newData(str: string): Data {
  let tag = Language.Unknown;
  
  if (str.includes(PIYOLOG_JA)) {
    tag = Language.Japanese;
  } else if (str.includes(PIYOLOG_EN)) {
    tag = Language.English;
  }
  
  return {
    tag,
    entries: []
  };
}

function newEntry(data: Data, str: string): EntryBuilder | null {
  if (str === '') {
    return null;
  }
  
  let dateStr = str;
  let format: string;
  
  switch (data.tag) {
    case Language.Japanese:
      dateStr = str.split('(')[0];
      format = 'YYYY/M/D';
      break;
    case Language.English:
      dateStr = str.split(', ')[1];
      format = 'MMM D, YYYY';
      break;
    default:
      return null;
  }
  
  const date = parseDate(dateStr, format);
  if (!date) {
    return null;
  }
  
  return new EntryBuilder(date);
}

function parseDate(dateStr: string, format: string): Date | null {
  // Simple date parsing - in production, you might want to use a library like date-fns
  try {
    if (format === 'YYYY/M/D') {
      const parts = dateStr.split('/');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (format === 'MMM D, YYYY') {
      return new Date(dateStr);
    }
    return null;
  } catch {
    return null;
  }
}

function newLog(line: string, date: Date): Log | null {
  const match = line.match(/^([0-9]{1,2}):([0-9]{2}) (AM|PM)?\s+(.+)$/);
  if (!match) {
    return null;
  }
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];
  const rest = match[4];
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  const createdAt = new Date(date);
  createdAt.setHours(hours, minutes, 0, 0);
  
  // Parse the rest of the line to extract type, content, and notes
  const parts = rest.split(/\s{2,}/);
  const type = parts[0];
  const content = parts[1] || '';
  const notes = parts[2] || undefined;
  
  return {
    type,
    content,
    notes,
    createdAt
  };
}

export function parse(str: string): Data {
  // Replace escape line breaks with unescaped line breaks
  str = str.replace(/\\n/g, '\n');
  
  // Add separator to handle as monthly data
  let exportData = `${str}\n\n${PIYOLOG_SEPARATOR}\n`;
  
  // Replace double newlines before separator
  exportData = exportData.replace(
    new RegExp(`\n\n${PIYOLOG_SEPARATOR}`, 'g'),
    `\n${PIYOLOG_SEPARATOR}`
  );
  
  const lines = exportData.split('\n');
  
  if (lines.length === 0) {
    throw new Error('Empty input');
  }
  
  // Parse the header
  const head = lines[0].trim();
  const data = newData(head);
  
  let cleanHead = head;
  switch (data.tag) {
    case Language.Japanese:
      cleanHead = head.replace(PIYOLOG_JA, '');
      break;
    case Language.English:
      cleanHead = head.replace(PIYOLOG_EN, '');
      break;
  }
  
  // Generate an entry with the head text
  let entry = newEntry(data, cleanHead);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith(PIYOLOG_SEPARATOR)) {
      if (entry) {
        data.entries.push(entry.build());
        entry = null;
      }
      continue;
    }
    
    if (!entry) {
      entry = newEntry(data, line);
    } else {
      entry.apply(line);
    }
  }
  
  return data;
}

// Export types for specific log types that might be needed
export interface FormulaLog extends Log {
  amount: number;
  unit: string;
}

export interface SleepLog extends Log {}

export interface WakeUpLog extends Log {
  duration: number; // in minutes
}

export interface BodyTemperatureLog extends Log {
  temperature: number;
  unit: string;
}

// Helper function to parse specific log types
export function parseLogType(log: Log): Log {
  if (log.type === 'ミルク' || log.type === 'Formula') {
    const match = log.content.match(/^(\d+)(ml)$/);
    if (match) {
      return {
        ...log,
        amount: parseInt(match[1], 10),
        unit: match[2]
      } as FormulaLog;
    }
  } else if (log.type === '起きる' || log.type === 'Wake up') {
    const match = log.content.match(/\((\d+)時間(\d+)分\)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      return {
        ...log,
        duration: hours * 60 + minutes
      } as WakeUpLog;
    }
  } else if (log.type === '体温' || log.type === 'Temperature') {
    const match = log.content.match(/^([\d.]+)(°C|°F)$/);
    if (match) {
      return {
        ...log,
        temperature: parseFloat(match[1]),
        unit: match[2]
      } as BodyTemperatureLog;
    }
  }
  
  return log;
}