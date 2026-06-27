'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'frontend_financial_boundary.baseline.json');

const STRONG_FINANCIAL_WORDS = [
  'vat', 'tax', 'wht', 'netamount', 'gross', 'subtotal', 'finaltotal',
  'totalamount', 'finalamount', 'commission', 'linetotal', 'pricewithoutvat',
  'pricewithvat', 'ضريبة', 'صافي', 'اجمالي', 'إجمالي', 'الإجمالي', 'عمولة'
];

const CONTEXT_FINANCIAL_WORDS = [
  'price', 'amount', 'invoice', 'discount', 'paid', 'payment', 'cost',
  'revenue', 'expense', 'profit', 'salary', 'payroll', 'balance',
  'سعر', 'فاتورة', 'خصم', 'تكلفة', 'إيراد', 'مصروف', 'ربح', 'راتب', 'رصيد'
];

const RULES = [
  {
    id: 'frontend-vat-rate',
    description: 'Frontend must not hard-code VAT/tax factors.',
    test: (line, executable) => /\b(?:0\.14|1\.14|14\s*%)\b/i.test(executable) && hasFinancialWord(line)
  },
  {
    id: 'frontend-financial-arithmetic',
    description: 'Frontend must not calculate financial totals, tax, net, gross, or commission.',
    test: (line, executable) => hasFinancialWord(line) && /(?:\+=|-=|\*=|\/=|[=:(,]\s*[^;\n]*(?:\+|-|\*|\/)[^;\n]*)/.test(executable)
  },
  {
    id: 'frontend-financial-reducer',
    description: 'Frontend must not reduce/sum financial values.',
    test: (line, executable) => hasFinancialWord(line) && /\.(?:reduce|map|forEach)\s*\(/i.test(executable)
  },
  {
    id: 'frontend-financial-calc-function',
    description: 'Frontend must not define financial calculation helpers.',
    test: (line, executable) => /\b(?:function\s+|const\s+|let\s+|var\s+)(?:calc|calculate|update)[A-Za-z0-9_]*(?:Total|Vat|VAT|Tax|Net|Gross|Commission|Amount|Financial)/.test(executable)
  }
];

function hasFinancialWord(line) {
  const normalized = line.toLowerCase().replace(/[_\-\s]/g, '');
  const hasStrongWord = STRONG_FINANCIAL_WORDS.some((word) => (
    normalized.includes(word.toLowerCase().replace(/[_\-\s]/g, ''))
  ));
  if (hasStrongWord) return true;

  const hasTotal = /(?:^|[^a-z])total(?:[^a-z]|$)/i.test(line) || /إجمالي|اجمالي/.test(line);
  if (!hasTotal) return false;

  return CONTEXT_FINANCIAL_WORDS.some((word) => normalized.includes(word.toLowerCase().replace(/[_\-\s]/g, '')));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (/\.(?:html|js)$/i.test(entry.name)) return [fullPath];
    return [];
  });
}

function stripNonExecutableHtml(raw) {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function normalizeLine(line) {
  return line.trim().replace(/\s+/g, ' ').slice(0, 240);
}

function stripStringLiterals(line) {
  return line
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function makeKey(violation) {
  return `${violation.file}|${violation.rule}|${violation.code}`;
}

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const raw = fs.readFileSync(filePath, 'utf8');
  const content = filePath.endsWith('.html') ? stripNonExecutableHtml(raw) : raw;

  const violations = [];
  content.split(/\r?\n/).forEach((line, index) => {
    const code = normalizeLine(line);
    if (!code) return;
    if (/^</.test(code) && !/\bon(?:input|change|click|blur|keyup)=/i.test(code)) return;
    const executableCode = stripStringLiterals(code);

    RULES.forEach((rule) => {
      if (rule.test(code, executableCode)) {
        violations.push({
          file: rel,
          line: index + 1,
          rule: rule.id,
          description: rule.description,
          code
        });
      }
    });
  });

  return violations;
}

function scan() {
  return walk(PUBLIC_DIR).flatMap(scanFile).sort((a, b) => {
    const fileSort = a.file.localeCompare(b.file);
    if (fileSort !== 0) return fileSort;
    return a.line - b.line || a.rule.localeCompare(b.rule);
  });
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return { violations: [] };
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function writeBaseline(violations) {
  const payload = {
    note: 'Existing frontend financial-calculation violations. New violations fail npm run guard:frontend-financial-boundary.',
    updatedAt: new Date().toISOString(),
    violations: violations.map((v) => ({
      file: v.file,
      rule: v.rule,
      code: v.code
    }))
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
  const updateBaseline = process.argv.includes('--update-baseline');
  const violations = scan();

  if (updateBaseline) {
    writeBaseline(violations);
    console.log(`Frontend financial boundary baseline updated: ${violations.length} existing violation(s).`);
    return;
  }

  const baseline = new Set((readBaseline().violations || []).map(makeKey));
  const newViolations = violations.filter((v) => !baseline.has(makeKey(v)));

  if (newViolations.length > 0) {
    console.error('Frontend financial boundary failed. Move calculations to backend services/routes.');
    newViolations.slice(0, 50).forEach((v) => {
      console.error(`${v.file}:${v.line} [${v.rule}] ${v.code}`);
    });
    if (newViolations.length > 50) {
      console.error(`...and ${newViolations.length - 50} more.`);
    }
    process.exit(1);
  }

  console.log(`Frontend financial boundary passed. ${violations.length} existing baseline violation(s), 0 new.`);
}

main();
