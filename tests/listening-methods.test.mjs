import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { FORMATS, gradePractice, isChoice, normalizePractice, validatePractice, wordDiff } from '../assets/js/listening-methods-core.js';

// Written forms and deliberately reworded choices are tied to exact spoken evidence.
// The value patterns are anchored so a new or changed answer needs its own review.
const spokenEvidence = {
  'delivery-details/postcode': [/^SW4 ?7PL$/, 'S, W, four, seven, P, L'],
  'delivery-details/delivery-date': [/^(?:(?:the )?14(?:th)? (?:of )?October|October 14(?:th)?|14[/-]10)$/, 'fourteenth of October'],
  'delivery-details/total-charge': [/^(?:£?38\.50?|38\.50 pounds|38 pounds 50(?: pence)?)$/, 'thirty-eight pounds fifty'],
  'shift-briefing/timesheets': [/^signed time sheets$/, 'signed timesheets'],
  'shift-briefing/cutoff-time': [/^(?:15 minutes past four|4[:.]15(?: p\.?m\.?)?|16:15|quarter past four|four fifteen)$/, 'fifteen minutes past four in the afternoon'],
  'parking-rule/meaning': [/^Employees may park at the back after 6 p\.m\.$/, 'Staff can leave their cars in the rear car park only after six in the evening'],
  'pickup-point/location': [/^The room next to the staff kitchen$/, 'the room beside the staff kitchen'],
  'daily-notices/room-fee': [/^Using a study room costs nothing if you reserve it in advance\.$/, 'free of charge, as long as they book at the help desk first'],
  'daily-notices/closing-time': [/^It will close before its normal time\.$/, 'shut two hours earlier than usual'],
  'daily-notices/towel-rule': [/^Members need to take their own towel to class\.$/, 'bring a clean towel to every exercise class'],
  'spoken-traps/correction-cue': [/^Oh, wait \/ Sorry, my mistake$/, 'oh, wait', 'Sorry, my mistake'],
  'spoken-traps/expense-method': [/^Upload scanned receipts on the staff portal$/, "scan and upload them through the staff portal"],
  'spoken-traps/negation-cue': [/^Hardly ever \/ Rather than$/, 'hardly ever', 'Rather than'],
  'spoken-traps/shipping-choice': [/^Regular mail service$/, 'standard post'],
  'policy-highlights/canteen-change': [/^Staff pay extra for disposable takeaway boxes\.$/, 'takeaway boxes will carry a small charge unless you bring a reusable container'],
  'policy-highlights/funding-condition': [/^A direct supervisor must confirm the course fits the employee's job\.$/, 'your line manager confirms the skill is relevant to your role'],
  'teen-or-ty/number': [/^14$/, 'fourteen'],
  'prices-and-teens/lunch-price': [/^£15\.50$/, 'fifteen pounds fifty'],
  'prices-and-teens/pass-price': [/^\$80$/, 'eighty dollars'],
  'prices-and-teens/wait-time': [/^30 minutes$/, 'thirty minutes'],
  'prices-and-teens/parking-fee': [/^£19\.20$/, 'nineteen pounds twenty'],
  'fast-workplace-speech/reduced-gonna': [/^going to$/, 'gonna'],
  'fast-workplace-speech/reduced-wanna': [/^want to$/, 'wanna'],
  'fast-workplace-speech/reduced-them': [/^give them$/, "give 'em"],
  'fast-workplace-speech/linking-out-of': [/^ran outta$/, 'ran out of'],
  'bike-repair-form/service-date': [/^(?:(?:the )?12(?:th)? (?:of )?May|May 12(?:th)?|12\/0?5)$/, 'twelfth of May'],
  'bike-repair-form/dropoff-time': [/^(?:0?8[:.]30(?: a\.?m\.?)?|eight thirty am)$/, 'eight thirty in the morning'],
  'bike-repair-form/service-fee': [/^45(?: pounds|\.00)$/, 'forty-five pounds'],
  'pottery-class-enquiry/start-date': [/^(?:(?:the )?4(?:th)? (?:of )?June|June 4(?:th)?|4\/0?6)$/, 'fourth of June'],
  'hall-hire-table/cedar-setup': [/^0?7[:.]45(?: a\.?m\.?)?$/, 'seven forty-five in the morning'],
  'tool-library-talk/closing-time': [/^(?:6[:.]30(?: p\.?m\.?)?|18:30|six thirty pm)$/, 'six thirty on weekday evenings'],
  'hotel-checkin/booking-ref': [/^HK(?:-| )?7049(?:-| )?M$/, 'H, K, seven, oh, four, nine, M'],
  'hotel-checkin/guest-email': [/^d\.brennan@coastalmail\.com$/, 'd dot brennan at coastalmail dot com'],
  'hotel-checkin/breakfast-end': [/^(?:0?9[:.]45(?: a\.?m\.?)?|quarter to ten)$/, 'until nine forty-five each morning'],
  'hotel-checkin/room-balance': [/^(?:\$?264\.85(?: dollars)?|264 dollars (?:and )?85(?: cents)?|two hundred sixty-four dollars and eighty-five cents)$/, 'two hundred and sixty-four dollars and eighty-five cents'],
  'repair-request/street-address': [/^76 Aldridge Grove$/, 'seventy-six Aldridge Grove'],
  'repair-request/tenant-email': [/^p\.nair@oakside\.org$/, 'p dot nair at oakside dot org'],
  'repair-request/repair-ref': [/^MN(?:-| )?3385(?:-| )?W$/, 'M, N, double three, eight, five, W'],
  'repair-request/plumber-time': [/^(?:11[:.]20(?: a\.?m\.?)?|eleven twenty)$/, 'twenty past eleven tomorrow morning'],
  'repair-request/inspection-fee': [/^(?:\$?49\.95(?: dollars)?|49 dollars (?:and )?95(?: cents)?)$/, 'inspection deposit of forty-nine dollars and ninety-five cents'],
  'clinic-appointment/fasting-rule': [/^should not eat anything$/, "shouldn't eat anything"],
  'timetable-updates/sentence-express': [
    /^Because of overnight track maintenance, the express train into central London will depart from platform 8 instead of platform 3\.$/,
    'Because of overnight track maintenance, the express train into central London will depart from platform eight instead of platform three'
  ],
  'timetable-updates/sentence-replacement': [
    /^A replacement bus picks up passengers outside the east exit every 20 minutes until regular rail services resume at noon\.$/,
    'A replacement bus picks up passengers outside the east exit every twenty minutes until regular rail services resume at noon'
  ],
  'timetable-updates/sentence-coach': [
    /^We've moved the final airport coach forward by 10 minutes, so please check in at the ticket desk before boarding\.$/,
    "We've moved the final airport coach forward by ten minutes, so please check in at the ticket desk before boarding"
  ],
  'gym-membership/fee-amount': [/^\$0 \(free of charge\)$/, 'the registration fee is completely waived this week'],
  'gym-membership/chosen-plan': [/^All-access membership$/, "I'd better take the all-access pass instead"],
  'gym-membership/plan-cue': [/^Come to think of it \/ instead$/, 'Come to think of it', 'instead'],
  'gym-membership/bundle-cost': [/^\$65$/, 'seventy-five dollars in total', 'our combined gym-and-pool bundle is actually ten dollars less than that'],
  'car-rental-traps/fuel-option': [/^Refill the tank before returning the car$/, 'bringing the car back with the tank topped up yourself'],
  'car-rental-traps/fuel-cue': [/^Rarely saves \/ far better off$/, 'rarely saves drivers money', "You're far better off"],
  'car-rental-traps/daily-limit': [/^250 kilometres$/, 'Two hundred kilometres applies to our city micro-cars', 'your daily allowance is fifty kilometres more than that'],
  'online-return/refund-rule': [/^Items must remain unopened with the original tag on to get all your money back\.$/, 'Unopened electronics', 'for a full refund', 'the original barcode label is still attached'],
  'online-return/damaged-shipping': [/^Download a prepaid return label from the order page\.$/, "you won't need to pay for return postage", 'download the prepaid parcel sticker from your order page'],
  'online-return/card-refund': [/^Within five business days after the warehouse checks the package in\.$/, 'warehouse scans your returned parcel', 'up to five working days'],
  'volunteer-orientation/helper-requirement': [/^Pairing up with a seasoned supervisor on their initial shift\.$/, 'shadow an experienced team leader during their first shift'],
  'volunteer-orientation/expense-claim': [/^Reimbursement of public transit tickets with proof of travel\.$/, 'volunteers who commute by public transport', 'claim back their bus or train fares by handing in paper or digital tickets'],
  'volunteer-orientation/wet-weather': [/^The group will move indoors to work on a different project\.$/, "we'll switch to repairing bird boxes inside the community hall"],
  'interview-schedule/interview-venue': [/^The annex office next to the central library$/, 'our annex office beside the central library'],
  'interview-schedule/what-to-bring': [/^Two short writing samples from a previous job$/, 'two short writing samples you produced in a previous role'],
  'course-enrolment/extra-requirement': [/^Buy a licence for the accounting software$/, 'you do have to purchase your own licence for the accounting software'],
  'course-enrolment/applicable-discount': [/^The 10% reduction with a valid library card$/, 'a ten-percent reduction for local council library members', 'showing your valid library card at payment is the only discount we can apply'],
  'car-rental-numbers/daily-rate': [/^£60$/, 'sixty pounds'],
  'car-rental-numbers/seat-price': [/^\$13\.40$/, 'thirteen dollars forty cents'],
  'car-rental-numbers/fuel-price': [/^£2\.18$/, 'two pounds eighteen pence'],
  'car-rental-numbers/cutoff-time': [/^7:15$/, 'by seven fifteen'],
  'car-rental-numbers/bay-and-wait': [/^Bay 14 · 40 mins$/, 'bay fourteen every forty minutes'],
  'returns-reduced-forms/reduced-gotta': [/^got to$/, "You've gotta print"],
  'returns-reduced-forms/reduced-send-them': [/^send them$/, "send 'em back"],
  'returns-reduced-forms/reduced-gonna-refund': [/^going to$/, "We're gonna issue"],
  'interview-connected-speech/assimilation-did-you': [/^did(?:ja| ya)$/, 'Did you get the calendar invite'],
  'interview-connected-speech/reduced-wanna-move': [/^want to$/, 'wanna move the video call'],
  'interview-connected-speech/reduced-tell-them': [/^tell them$/, "tell 'em you're here"],
  'interview-connected-speech/elision-at-least-ten': [/^at least 10$/, 'at least ten minutes early'],
  'hotel-checkin-form/checkout-date': [/^(?:(?:the )?18(?:th)? (?:of )?October|October 18(?:th)?|18\/10)$/, 'eighteenth of October'],
  'hotel-checkin-form/room-number': [/^(?:412|four one two)$/, 'room four twelve'],
  'hotel-checkin-form/breakfast-start': [/^0?6[:.]45(?: a\.?m\.?)?$/, 'six forty-five in the morning'],
  'clinic-appointment-form/appointment-date': [/^(?:(?:the )?9(?:th)? (?:of )?September|September 9(?:th)?|0?9\/0?9)$/, 'ninth of September'],
  'clinic-appointment-form/appointment-time': [/^(?:10[:.]15(?: a\.?m\.?)?|ten fifteen am)$/, 'ten fifteen in the morning'],
  'clinic-appointment-form/consultation-fee': [/^65(?: dollars|\.00)$/, 'the standard appointment is sixty-five dollars'],
  'gym-membership-table/offpeak-fee': [/^38(?: pounds|\.00)$/, 'Our Off-Peak plan costs thirty-eight pounds a month'],
  'gym-membership-table/offpeak-cutoff': [/^(?:4[:.]30(?: p\.?m\.?)?|16:30|four thirty pm)$/, 'four thirty in the afternoon'],
  'gym-membership-table/waiver-deadline': [/^(?:(?:the )?22(?:nd)? (?:of )?March|March 22(?:nd)?|22\/0?3)$/, 'before the twenty-second of March'],
  'course-enrolment-notes/enrolment-deadline': [/^(?:(?:the )?14(?:th)? (?:of )?August|August 14(?:th)?|14\/08)$/, 'by the fourteenth of August']
};

function hasSpokenAnswer(exercise, clip, item, value) {
  const normal = text => normalizePractice(text, item.rules);
  const expected = normal(value);
  const lines = clip.script.map(line => normalizePractice(line.text, { spelling: false }));
  const contains = text => lines.some(line => ` ${line} `.includes(` ${normalizePractice(text, { spelling: false })} `));
  if (exercise.format === 'word-count') {
    return expected === String(lines.flatMap(line => line.split(' ')).length);
  }
  const literal = lines.some(line => {
    const words = line.split(' ');
    return words.some((_, start) => words.slice(start).some((_, offset) =>
      normal(words.slice(start, start + offset + 1).join(' ')) === expected));
  });
  if (literal) return true;
  const evidence = spokenEvidence[`${exercise.id}/${item.id}`];
  return Boolean(evidence && evidence[0].test(value) && evidence.slice(1).every(contains));
}

test('normalizes case, punctuation and spelling while preserving meaningful distinctions', () => {
  assert.equal(normalizePractice('  The COLOUR,\n of the centre! '), 'the color of the center');
  assert.equal(normalizePractice('colour', { spelling: false }), 'colour');
  assert.equal(normalizePractice('£1,402.50.'), '1402.50');
  assert.notEqual(normalizePractice('1.5'), normalizePractice('15'));
  assert.notEqual(normalizePractice('badges'), normalizePractice('badge'));
  assert.notEqual(normalizePractice('walked'), normalizePractice('walk'));
  assert.notEqual(normalizePractice('clarke'), normalizePractice('clark'));
});

test('limits numeric equivalence to the item policy and keeps phone zeros', () => {
  assert.equal(normalizePractice('FOURTEEN', { numbers: 'integer' }), '14');
  assert.equal(normalizePractice('Forty-two.', { numbers: 'integer' }), '42');
  assert.equal(normalizePractice('0014', { numbers: 'integer' }), '14');
  assert.equal(normalizePractice('Oh seven double two, six one five', { numbers: 'digits' }), '0722615');
  assert.equal(normalizePractice('(0722) 615', { numbers: 'digits' }), '0722615');
  assert.notEqual(normalizePractice('fourteen'), normalizePractice('14'));
  assert.notEqual(normalizePractice('40', { numbers: 'integer' }), normalizePractice('fourteen', { numbers: 'integer' }));
  assert.notEqual(normalizePractice('722615', { numbers: 'digits' }), '0722615');
});

test('expands only supported contractions where the item allows it', () => {
  assert.equal(normalizePractice('He must’ve left.', { contractions: true }), 'he must have left');
  assert.equal(normalizePractice('I can’t go.', { contractions: true }), 'i can not go');
  assert.equal(normalizePractice('must’ve'), "must've");
  assert.equal(normalizePractice("she'd", { contractions: true }), "she'd");
  assert.notEqual(normalizePractice('must of', { contractions: true }), 'must have');
});

test('scores selected prediction types separately from final answers and accepts explicit variants', () => {
  const exercise = { format: 'predict-verify', clips: [{ items: [
    { id: 'day', expectedType: 'date', answer: 'September 5', variants: ['5 September'] },
    { id: 'name', expectedType: 'name', answer: 'Clarke' }
  ] }] };
  assert.deepEqual(gradePractice(exercise, { day: '5 September', name: 'Clark' }, { day: 'noun', name: 'name' }), {
    outcomes: [{ id: 'day', correct: true, predicted: false }, { id: 'name', correct: false, predicted: true }],
    correct: 1, total: 2, predictionCorrect: 1, predictionTotal: 2
  });
  assert.equal(gradePractice(exercise).correct, 0);
  const choices = { format: 'number-contrast', clips: [{ items: [{ id: 'n', answer: 'fourteen' }] }] };
  assert.equal(gradePractice(choices, { n: 'forty' }).correct, 0);
  assert.equal(gradePractice(choices, { n: 'fourteen' }).correct, 1);
});

test('word-level diff aligns inserted, absent and misspelled words', () => {
  assert.deepEqual(wordDiff('We quickly walk home', 'We walked home'), [
    { kind: 'same', word: 'we' }, { kind: 'extra', word: 'quickly' },
    { kind: 'extra', word: 'walk' }, { kind: 'missing', word: 'walked' }, { kind: 'same', word: 'home' }
  ]);
  assert.deepEqual(wordDiff('The COLOR!', 'The colour'), [
    { kind: 'same', word: 'the' }, { kind: 'same', word: 'color' }
  ]);
});

test('every published exercise has transcript-backed grading, synced routes, and decodable MP3s', async () => {
  const root = new URL('../', import.meta.url);
  const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const catalog = await load('content/ielts-gt/listening/index.json');
  assert.equal(catalog.tests.length, 4);
  const docs = await readFile(new URL('docs/listening-methods-schema.md', root), 'utf8');
  const schema = JSON.parse(/```json\n([\s\S]+?)\n```/.exec(docs)[1]);
  assert.deepEqual(schema.items.properties.format.enum, Object.values(FORMATS).flat());
  assert.deepEqual(catalog.methods.map(method => method.id).sort(), Object.keys(FORMATS).sort());
  const exerciseIds = new Set();
  const audioPaths = new Set();
  for (const method of catalog.methods) {
    const exercises = await load(method.file);
    assert.deepEqual(method.exercises, exercises.map(({ id, title }) => ({ id, title })));
    assert.deepEqual(new Set(exercises.map(entry => entry.format)), new Set(FORMATS[method.id]));
    for (const exercise of exercises) {
      assert.ok(!exerciseIds.has(exercise.id), `Duplicate exercise ID: ${exercise.id}`);
      exerciseIds.add(exercise.id);
      assert.deepEqual(validatePractice(exercise, method.id), [], exercise.id);
      assert.equal(gradePractice(exercise).correct, 0, exercise.id);
      const answers = Object.create(null);
      const predictions = Object.create(null);
      for (const clip of exercise.clips) {
        const { audio } = clip;
        assert.ok(!audioPaths.has(audio), `Duplicate audio: ${audio}`);
        audioPaths.add(audio);
        const file = fileURLToPath(new URL(audio, root));
        const decoded = spawnSync(ffmpeg, ['-v', 'error', '-xerror', '-nostdin', '-f', 'mp3', '-i', file, '-map', '0:a:0', '-f', 'null', '-'], {
          encoding: 'utf8', timeout: 5000, windowsHide: true
        });
        assert.equal(decoded.status, 0, `${audio}: ${decoded.stderr || decoded.error}`);
        for (const item of clip.items) {
          const ref = `${exercise.id}/${clip.id}/${item.id}`;
          const label = isChoice(exercise.format) ? item.choices.find(choice => choice.id === item.answer).label : item.answer;
          assert.ok(hasSpokenAnswer(exercise, clip, item, label), `${ref}: missing evidence for "${label}"`);
          answers[item.id] = item.answer;
          if (item.expectedType) predictions[item.id] = item.expectedType;
          for (const variant of item.variants ?? []) {
            assert.ok(hasSpokenAnswer(exercise, clip, item, variant), `${ref}: missing evidence for variant "${variant}"`);
            assert.equal(gradePractice(exercise, { [item.id]: variant }).correct, 1, `${ref}: did not accept "${variant}"`);
          }
          for (const choice of item.choices ?? []) {
            assert.equal(gradePractice(exercise, { [item.id]: choice.id }).correct, Number(choice.id === item.answer), `${ref}: ${choice.id}`);
          }
        }
      }
      const result = gradePractice(exercise, answers, predictions);
      assert.equal(result.correct, result.total, exercise.id);
      assert.equal(result.predictionCorrect, Object.keys(predictions).length, exercise.id);
      const tatoeba = exercise.clips.findIndex(clip => clip.source.kind === 'tatoeba');
      if (tatoeba >= 0) {
        const invalid = structuredClone(exercise);
        invalid.clips[tatoeba].source.audioLicence = 'https://creativecommons.org/licenses/by-nc/4.0/';
        assert.match(validatePractice(invalid, method.id).join(' '), /invalid source/);
      }
    }
  }
});
