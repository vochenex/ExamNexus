/**
 * Repair missing spaces in AI/OCR text (e.g. "WhatICTsectorisresponsible...").
 * Structural boundaries first; if still glued, resegment letter-runs with a
 * compact English lexicon (longest-match DP).
 */

const COMMON_WORDS = [
  "telecommunications","responsibility","responsible","identification","information",
  "communication","communications","environment","organization","organisation",
  "development","government","technology","technologies","application","applications",
  "difference","different","important","importance","education","educational",
  "assessment","questionnaire","enumeration","multiple","choice","question",
  "questions","following","according","available","equipment","satellite","satellites",
  "internet","network","networks","computer","computers","software","hardware",
  "database","security","password","student","students","teacher","teachers",
  "faculty","subject","subjects","chapter","section","sections","process","processes",
  "function","functions","example","examples","problem","problems","solution",
  "solutions","research","science","sciences","biology","chemistry","physics",
  "history","geography","mathematics","algebra","geometry","literature","language",
  "english","filipino","cellular","wireless","optical","digital","analog","analogue",
  "fiber","fibre","optic","cables","cable","phones","phone","radio","radios",
  "distance","distances","sending","receiving","sector","sectors","industry",
  "industries","business","economy","economic","political","cultural","social",
  "natural","resources","resource","energy","power","system","systems","device",
  "devices","mobile","telephone","telephones","message","messages","signal",
  "signals","transmit","transmission","receive","receiver","sender","media",
  "medium","content","context","concept","concepts","definition","definitions",
  "describe","explain","compare","contrast","analyze","analyse","evaluate",
  "identify","enumerate","discuss","state","define","list","name","choose",
  "select","which","what","when","where","whose","whom","why","how","who",
  "true","false","correct","incorrect","answer","answers","choice","choices",
  "option","options","statement","statements","paragraph","sentence","sentences",
  "because","through","between","without","within","during","before","after",
  "about","above","below","under","over","into","onto","from","with","that",
  "this","these","those","there","their","they","them","then","than","thus",
  "also","only","just","even","still","already","always","never","often",
  "sometimes","usually","mainly","mostly","almost","another","other","others",
  "each","every","either","neither","both","some","any","many","much","more",
  "most","least","less","few","several","such","same","being","been","have",
  "has","had","does","did","will","would","could","should","might","must",
  "shall","can","may","are","was","were","been","being","is","am","be","do",
  "the","and","for","not","you","all","any","can","had","her","was","one",
  "our","out","day","get","has","him","his","how","man","new","now","old",
  "see","two","way","who","boy","did","its","let","put","say","she","too",
  "use","using","used","uses","long","short","high","low","large","small",
  "first","second","third","next","last","main","primary","secondary","basic",
  "common","general","specific","particular","certain","various","several",
  "people","person","human","humans","animal","animals","plant","plants",
  "earth","world","country","countries","city","cities","school","schools",
  "university","college","class","classes","grade","level","levels","year",
  "years","time","times","date","dates","number","numbers","value","values",
  "data","type","types","form","forms","part","parts","role","roles","goal",
  "goals","result","results","cause","causes","effect","effects","reason",
  "reasons","method","methods","step","steps","stage","stages","phase",
  "phases","order","ordered","sequence","based","among","across","against",
  "around","behind","beyond","inside","outside","toward","towards","until",
  "while","where","whether","although","however","therefore","otherwise",
  "instead","including","included","provide","provides","provided","require",
  "requires","required","include","includes","contain","contains","support",
  "supports","allow","allows","help","helps","make","makes","made","take",
  "takes","taken","give","gives","given","show","shows","shown","know",
  "known","think","thought","need","needs","needed","want","wants","like",
  "likes","call","called","calls","come","comes","came","go","goes","went",
  "find","finds","found","keep","keeps","kept","let","leave","left","seem",
  "seems","become","becomes","became","begin","begins","began","begun","end",
  "ends","ended","start","starts","started","finish","finished","create",
  "creates","created","produce","produces","produced","generate","generated",
  "perform","performs","performed","operate","operates","operated","control",
  "controls","managed","manage","connect","connected","related","relate",
  "refer","refers","referred","mean","means","meant","measure","measured",
  "calculate","calculated","determine","determined","consider","considered",
  "involve","involves","involved","occur","occurs","occurred","happen",
  "happens","happened","exist","exists","existed","appear","appears","appeared",
  "remain","remains","remained","continue","continues","continued","change",
  "changes","changed","increase","increased","decrease","decreased","improve",
  "improved","reduce","reduced","prevent","prevented","protect","protected",
  "provide","obtain","obtained","receive","received","send","sent","transfer",
  "transferred","move","moved","place","placed","position","located","location",
  "area","areas","region","regions","field","fields","domain","domains",
  "ict","it","ai","ui","ux","api","cpu","gpu","ram","rom","os","pc","id",
  "a","an","of","to","in","on","at","by","as","or","if","so","up","no","yes",
  "i","we","he","me","my","us","vs","via","per","etc","eg","ie",
];

const WORD_SET = new Set(COMMON_WORDS.map((w) => w.toLowerCase()));
const SORTED_WORDS = [...WORD_SET].sort((a, b) => b.length - a.length);
const MAX_WORD_LEN = SORTED_WORDS[0]?.length || 20;

function looksMissingSpaces(text) {
  const s = String(text || "").trim();
  if (s.length < 24) return false;
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  if (letters < 20) return false;
  const spaces = (s.match(/ /g) || []).length;
  // Healthy English is roughly 1 space per 5–6 letters; far below that → glued.
  return spaces * 10 < letters;
}

function breakGluedLetters(run) {
  const raw = String(run || "");
  if (raw.length < 8) return raw;
  const lower = raw.toLowerCase();
  const n = lower.length;
  const prev = new Array(n + 1).fill(-1);
  prev[0] = 0;

  for (let i = 0; i < n; i += 1) {
    if (prev[i] < 0) continue;
    let matched = false;
    const max = Math.min(MAX_WORD_LEN, n - i);
    for (let len = max; len >= 1; len -= 1) {
      const slice = lower.slice(i, i + len);
      if (!WORD_SET.has(slice)) continue;
      const next = i + len;
      if (prev[next] < 0) prev[next] = i;
      matched = true;
    }
    // Last resort so DP can finish when a rare token appears mid-string.
    if (!matched && prev[i + 1] < 0) prev[i + 1] = i;
  }

  if (prev[n] < 0) return raw;

  const parts = [];
  let idx = n;
  while (idx > 0) {
    const start = prev[idx];
    if (start < 0 || start >= idx) break;
    parts.push(raw.slice(start, idx));
    idx = start;
  }
  parts.reverse();

  if (parts.length <= 1) return raw;
  return parts.join(" ");
}

function resegmentLetterRuns(text) {
  return String(text || "").replace(/[A-Za-z]{8,}/g, (run) => breakGluedLetters(run));
}

function splitCapsBoundary(run) {
  const text = String(run || "");
  const firstLower = text.search(/[a-z]/);
  if (firstLower < 2) return text;
  if (!/^[A-Z]{2,}/.test(text)) return text;

  const candidates = [];

  // ICT|sector — split at first lowercase
  if (/^[A-Z]+$/.test(text.slice(0, firstLower))) {
    candidates.push([text.slice(0, firstLower), text.slice(firstLower)]);
  }

  // JSON|Data — keep Pascal capital with the lowercase tail
  if (firstLower >= 3 && /^[A-Z]+$/.test(text.slice(0, firstLower - 1))) {
    candidates.push([text.slice(0, firstLower - 1), text.slice(firstLower - 1)]);
  }

  if (!candidates.length) return text;

  const score = ([left, right]) => {
    let points = 0;
    const rightLower = right.toLowerCase();
    const leftLower = left.toLowerCase();
    if (WORD_SET.has(leftLower)) points += 3;
    if (WORD_SET.has(rightLower)) points += 6;
    if (/^[a-z]/.test(right)) points += 3; // prefer acronym|lowercaseword
    if (/^[A-Z][a-z]/.test(right) && WORD_SET.has(rightLower)) points += 5;
    // Long glued lowercase tails still benefit from acronym|rest for later DP.
    if (/^[a-z]/.test(right) && right.length >= 6) points += 2;
    return points;
  };

  candidates.sort((a, b) => score(b) - score(a));
  const [left, right] = candidates[0];
  return `${left} ${right}`;
}

function repairStructuralSpacing(text) {
  let result = String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/([,;:])([^\s])/g, "$1 $2")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/(\S)(\(|\{|\[)/g, "$1 $2")
    .replace(/(\)|\}|\])(\S)/g, "$1 $2");

  result = result.replace(/[A-Za-z0-9]+/g, (run) => splitCapsBoundary(run));

  return result
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Fix missing spaces in free-text fields from AI or OCR.
 */
function repairMissingSpaces(value) {
  let text = String(value || "").trim();
  if (!text) return "";

  text = repairStructuralSpacing(text);

  if (looksMissingSpaces(text)) {
    text = resegmentLetterRuns(text);
    text = repairStructuralSpacing(text);
  }

  return text.replace(/[ \t]{2,}/g, " ").trim();
}

module.exports = {
  repairMissingSpaces,
  looksMissingSpaces,
};
