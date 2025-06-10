import { describe, it, expect, beforeAll } from 'vitest';
import { parse, Language, setTimezone, parseLogType } from '../src/piyolog';
import type { Data, Entry, Baby, Log, FormulaLog, SleepLog, WakeUpLog, BodyTemperatureLog } from '../src/piyolog';

// Set timezone for tests
beforeAll(() => {
  setTimezone('Asia/Tokyo');
});

describe('piyolog', () => {
  describe('parse', () => {
    it('should parse Japanese header correctly', () => {
      const input = `【ぴよログ】2022/6/13(木)`;
      const result = parse(input);
      
      expect(result.tag).toBe(Language.Japanese);
      expect(result.entries).toHaveLength(1);
    });

    it('should parse English header correctly', () => {
      const input = `[PiyoLog]Thu, Jun 13, 2022`;
      const result = parse(input);
      
      expect(result.tag).toBe(Language.English);
      expect(result.entries).toHaveLength(1);
    });

    it('should parse unknown header correctly', () => {
      const input = `Thu, Jun 13, 2022`;
      const result = parse(input);
      
      expect(result.tag).toBe(Language.Unknown);
      expect(result.entries).toHaveLength(0);
    });

    it('should parse single entry with logs', () => {
      const input = `【ぴよログ】2023/12/31(水)

08:45 AM   ミルク 140ml   たくさん飲んだ`;

      const result = parse(input);
      
      expect(result.tag).toBe(Language.Japanese);
      expect(result.entries).toHaveLength(1);
      
      const entry = result.entries[0];
      expect(entry.date).toEqual(new Date(2023, 11, 31)); // December is month 11
      expect(entry.baby).toBeUndefined();
      expect(entry.logs).toHaveLength(1);
      
      const log = entry.logs[0];
      expect(log.type).toBe('ミルク');
      expect(log.content).toBe('140ml');
      expect(log.notes).toBe('たくさん飲んだ');
      expect(log.createdAt).toEqual(new Date(2023, 11, 31, 8, 45, 0, 0));
    });

    it('should parse entry with baby information', () => {
      const input = `【ぴよログ】2023/12/31(水)
ごふあ (0歳1か月1日)

08:45 AM   ミルク 140ml   たくさん飲んだ
01:55 PM   寝る   
02:45 PM   起きる (0時間50分)   
03:05 PM   体温 36.4°C   
03:50 PM   ミルク 140ml   
07:35 PM   ミルク 200ml   

母乳合計　　   左 7分 / 右 5分
ミルク合計　   7回 1140ml
睡眠合計　　   11時間50分
おしっこ合計   2回
うんち合計　   1回

お食い初めだよ


これは改行です



ここまで`;

      const result = parse(input);
      
      expect(result.tag).toBe(Language.Japanese);
      expect(result.entries).toHaveLength(1);
      
      const entry = result.entries[0];
      expect(entry.date).toEqual(new Date(2023, 11, 31));
      
      // Check baby
      expect(entry.baby).toBeDefined();
      expect(entry.baby!.name).toBe('ごふあ');
      expect(entry.baby!.dateOfBirth).toEqual(new Date(2023, 10, 30)); // November 30
      
      // Check logs
      expect(entry.logs).toHaveLength(6);
      
      // Check results
      expect(entry.results).toEqual([
        '母乳合計　　   左 7分 / 右 5分',
        'ミルク合計　   7回 1140ml',
        '睡眠合計　　   11時間50分',
        'おしっこ合計   2回',
        'うんち合計　   1回'
      ]);
      
      // Check journal
      expect(entry.journal).toBe(`お食い初めだよ


これは改行です



ここまで`);
    });

    it('should parse escaped newlines', () => {
      const input = `【ぴよログ】2023/12/31(水)\\nごふあ (0歳1か月1日)\\n\\n\\n08:45 AM   ミルク 140ml   たくさん飲んだ\\n01:55 PM   寝る   \\n02:45 PM   起きる (0時間50分)   \\n03:05 PM   体温 36.4°C   \\n03:50 PM   ミルク 140ml   \\n07:35 PM   ミルク 200ml   `;

      const result = parse(input);
      
      expect(result.tag).toBe(Language.Japanese);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].logs).toHaveLength(6);
    });

    it('should parse multiple entries', () => {
      const input = `【ぴよログ】2024年8月
----------
2024/8/1(木)
ごふあ (0歳2か月10日)

04:15 AM   起きる (8時間40分)   
04:20 AM   ミルク 110ml   
08:00 PM   寝る   

母乳合計　　   左 0分 / 右 0分
ミルク合計　   7回 790ml
睡眠合計　　   12時間35分
おしっこ合計   3回
うんち合計　   1回

----------
2024/8/2(金)
ごふあ (0歳2か月11日)

04:15 AM   起きる (8時間40分)   
04:20 AM   ミルク 110ml   
08:00 PM   寝る   

母乳合計　　   左 0分 / 右 0分
ミルク合計　   8回 750ml
睡眠合計　　   13時間50分
おしっこ合計   4回
うんち合計　   1回

----------
2024/8/4(土)
ごふあ (0歳2か月13日)

04:15 AM   起きる (8時間40分)   
04:20 AM   ミルク 110ml   
08:00 PM   寝る   

母乳合計　　   左 0分 / 右 0分
ミルク合計　   7回 750ml
睡眠合計　　   14時間0分
おしっこ合計   2回
うんち合計　   0回

お食い初めだよ

----------`;

      const result = parse(input);
      
      expect(result.tag).toBe(Language.Japanese);
      expect(result.entries).toHaveLength(3);
      
      // Check first entry
      const entry1 = result.entries[0];
      expect(entry1.date).toEqual(new Date(2024, 7, 1)); // August 1
      expect(entry1.baby!.name).toBe('ごふあ');
      expect(entry1.baby!.dateOfBirth).toEqual(new Date(2024, 4, 22)); // May 22
      expect(entry1.logs).toHaveLength(3);
      expect(entry1.results).toHaveLength(5);
      expect(entry1.journal).toBe('');
      
      // Check second entry
      const entry2 = result.entries[1];
      expect(entry2.date).toEqual(new Date(2024, 7, 2));
      expect(entry2.logs).toHaveLength(3);
      
      // Check third entry
      const entry3 = result.entries[2];
      expect(entry3.date).toEqual(new Date(2024, 7, 4));
      expect(entry3.journal).toBe('お食い初めだよ');
    });

    it('should parse English format baby info', () => {
      const input = `[PiyoLog]Thu, Feb 29, 2024
Baby (0y0m22d)

08:45 AM   Formula 140ml   Drank a lot`;

      const result = parse(input);
      
      expect(result.tag).toBe(Language.English);
      expect(result.entries).toHaveLength(1);
      
      const entry = result.entries[0];
      expect(entry.baby).toBeDefined();
      expect(entry.baby!.name).toBe('Baby');
      expect(entry.baby!.dateOfBirth).toEqual(new Date(2024, 1, 7)); // February 7
    });

    it('should handle empty input', () => {
      expect(() => parse('')).toThrow('Empty input');
    });

    it('should handle invalid baby format', () => {
      const input = `ごふあ (0歳1か月0日)`;
      const result = parse(input);
      
      expect(result.tag).toBe(Language.Unknown);
      expect(result.entries).toHaveLength(0);
    });
  });

  describe('parseLogType', () => {
    const date = new Date(2023, 11, 31, 0, 0, 0, 0);
    
    it('should parse formula log', () => {
      const log: Log = {
        type: 'ミルク',
        content: '140ml',
        notes: 'たくさん飲んだ',
        createdAt: new Date(date.setHours(8, 45, 0, 0))
      };
      
      const parsed = parseLogType(log) as FormulaLog;
      expect(parsed.amount).toBe(140);
      expect(parsed.unit).toBe('ml');
    });

    it('should parse wake up log', () => {
      const log: Log = {
        type: '起きる',
        content: '(3時間35分)',
        notes: '',
        createdAt: new Date(date.setHours(2, 55, 0, 0))
      };
      
      const parsed = parseLogType(log) as WakeUpLog;
      expect(parsed.duration).toBe(3 * 60 + 35);
    });

    it('should parse body temperature log', () => {
      const log: Log = {
        type: '体温',
        content: '36.5°C',
        notes: '',
        createdAt: new Date(date.setHours(14, 30, 0, 0))
      };
      
      const parsed = parseLogType(log) as BodyTemperatureLog;
      expect(parsed.temperature).toBe(36.5);
      expect(parsed.unit).toBe('°C');
    });

    it('should return original log for unknown types', () => {
      const log: Log = {
        type: 'お風呂',
        content: '',
        notes: '',
        createdAt: new Date(date.setHours(19, 10, 0, 0))
      };
      
      const parsed = parseLogType(log);
      expect(parsed).toEqual(log);
    });
  });

  describe('log parsing', () => {
    const date = new Date(2023, 11, 31);

    it('should parse various log types correctly', () => {
      const input = `【ぴよログ】2023/12/31(水)

23:00   母乳 左 7分 / 右 5分 (50ml)   たくさん飲んだ
08:45 AM   ミルク 140ml   たくさん    飲んだ
23:10   離乳食   たくさん食べた
02:55   起きる (3時間35分)   
08:00 PM   寝る   
06:40   おしっこ   
23:15   うんち (少なめ/ふつう/緑)   たくさん出た
19:10   お風呂   
14:30   体温 36.5°C   `;

      const result = parse(input);
      const logs = result.entries[0].logs;

      expect(logs).toHaveLength(9);

      // Check nursing log
      expect(logs[0].type).toBe('母乳');
      expect(logs[0].content).toBe('左 7分 / 右 5分 (50ml)');
      expect(logs[0].notes).toBe('たくさん飲んだ');
      expect(logs[0].createdAt).toEqual(new Date(2023, 11, 31, 23, 0, 0, 0));

      // Check formula log
      expect(logs[1].type).toBe('ミルク');
      expect(logs[1].content).toBe('140ml');
      expect(logs[1].notes).toBe('たくさん    飲んだ');
      expect(logs[1].createdAt).toEqual(new Date(2023, 11, 31, 8, 45, 0, 0));

      // Check solid food log
      expect(logs[2].type).toBe('離乳食');
      expect(logs[2].content).toBe('');
      expect(logs[2].notes).toBe('たくさん食べた');

      // Check wake up log
      expect(logs[3].type).toBe('起きる');
      expect(logs[3].content).toBe('(3時間35分)');

      // Check sleep log
      expect(logs[4].type).toBe('寝る');
      expect(logs[4].createdAt).toEqual(new Date(2023, 11, 31, 20, 0, 0, 0));

      // Check pee log
      expect(logs[5].type).toBe('おしっこ');

      // Check poop log
      expect(logs[6].type).toBe('うんち');
      expect(logs[6].content).toBe('(少なめ/ふつう/緑)');
      expect(logs[6].notes).toBe('たくさん出た');

      // Check bath log
      expect(logs[7].type).toBe('お風呂');

      // Check temperature log
      expect(logs[8].type).toBe('体温');
      expect(logs[8].content).toBe('36.5°C');
    });
  });
});