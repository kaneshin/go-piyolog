import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, parseLogType, FormulaLog, Log } from './src/piyolog';

async function main() {
  const filePath = path.join(__dirname, '_example', 'daily.txt');
  const body = fs.readFileSync(filePath, 'utf-8');
  const data = parse(body);

  if (data.entries.length === 0) {
    console.error('No entries found.');
    process.exit(1);
  }

  const daily = data.entries[data.entries.length - 1];
  const baby = daily.baby;
  console.log(`Daily Report: ${daily.date.toLocaleDateString('ja-JP')}`);
  if (baby) {
    console.log(`Baby: ${baby.name} (Birthday: ${baby.dateOfBirth.toLocaleDateString('ja-JP')})`);
  }

  const milks: FormulaLog[] = [];
  let count = 0;
  let sum = 0;
  let unit = '';
  for (const log of daily.logs) {
    const parsed = parseLogType(log);
    if ('amount' in parsed && 'unit' in parsed) {
      milks.push(parsed as FormulaLog);
      sum += (parsed as FormulaLog).amount;
      count++;
      unit = (parsed as FormulaLog).unit;
    }
  }

  console.log('\n-- Milk Stats --');
  for (const milk of milks) {
    console.log(`- ${milk.createdAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ${milk.type} ${milk.amount}${milk.unit}`);
  }
  if (count > 0) {
    console.log(`-> Avg: ${(sum / count).toFixed(2)}${unit}`);
  }

  // Pee stats (type: おしっこ)
  const pees: Log[] = daily.logs.filter(l => l.type === 'おしっこ');
  console.log('\n-- Pee Stats --');
  for (const pee of pees) {
    console.log(`- ${pee.createdAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ${pee.type}`);
  }

  console.log('\n-- Comment --');
  console.log(daily.journal);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
