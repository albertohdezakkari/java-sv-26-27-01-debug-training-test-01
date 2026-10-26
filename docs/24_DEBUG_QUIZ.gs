/** Cuestionario 1SI · Debug training · servidor de notas. */
const F24_DEBUG_SPREADSHEET_ID = '1-qPuyft2X55Wd1J7bpkbl7B51I9ZpjIiqTCdR_VlWdw';
const F24_DEBUG_TEST = '1SI-JAVA-DEBUG-TEST-01';
const F24_DEBUG_CHALLENGE = '1SI-JAVA-DEBUG-CHALLENGE-01';

function F24_debugTable_(sheet) {
  if (!sheet) throw new Error('Falta una pestaña del registro de cuestionarios.');
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  return values.filter(row => row.some(v => v !== '')).map(row => {
    const item = {}; headers.forEach((h, i) => item[h] = row[i]); return item;
  });
}
function F24_debugYes_(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() === 'SI';
}
function F24_debugNameKey_(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');
}
function F24_debugPrepare_(payload, questions, students, config) {
  if (!payload || ![F24_DEBUG_TEST, F24_DEBUG_CHALLENGE].includes(payload.quiz) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload.attemptId || ''))) {
    throw new Error('El intento no se ha podido identificar.');
  }
  const settings = config.filter(r => r.QUIZ === payload.quiz && F24_debugYes_(r.ACTIVO));
  if (settings.length !== 1 || Number(settings[0]['Nº PREGUNTAS']) !== 20 || Number(settings[0].SEGUNDOS) !== 60) {
    throw new Error('Este modo aún no está preparado para registrar notas.');
  }
  const key = F24_debugNameKey_(payload.alumno);
  const matches = students.filter(r => r.GRUPO === '1SI-JAVA' && F24_debugYes_(r.ACTIVO) && F24_debugNameKey_(r.ALUMNO) === key);
  if (!key || matches.length !== 1) throw new Error('No encuentro un único alumno activo con ese nombre. Revisa cómo aparece en Classroom.');
  const official = matches[0];
  const prefix = payload.quiz === F24_DEBUG_TEST ? 'DGTQ' : 'DGCQ';
  const bank = questions.filter(r => r.QUIZ === payload.quiz && F24_debugYes_(r.ACTIVA));
  if (bank.length !== 80 || new Set(bank.map(q => q.ID)).size !== 80 ||
      bank.some(q => !/^[ABCD]$/.test(String(q.CORRECTA || '').trim()))) {
    throw new Error('El banco oficial de 80 preguntas necesita revisión.');
  }
  if (!Array.isArray(payload.respuestas) || payload.respuestas.length !== 20) throw new Error('El cuestionario debe incluir 20 respuestas.');
  const seen = new Set(), detail = []; let correct = 0, wrong = 0, blank = 0;
  payload.respuestas.forEach(answer => {
    if (!answer || seen.has(answer.preguntaId)) throw new Error('Hay una pregunta duplicada en este intento.');
    seen.add(answer.preguntaId);
    const question = bank.find(q => q.ID === answer.preguntaId);
    const choice = String(answer.respuesta || '').trim().toUpperCase();
    const seconds = Number(answer.segundos);
    if (!question || !String(question.ID).startsWith(prefix) || !/^[ABCD]?$/.test(choice) ||
        !Number.isInteger(seconds) || seconds < 0 || seconds > 60) throw new Error('Una respuesta o un tiempo no es válido.');
    if (choice && seconds >= 60) throw new Error('Una respuesta se envió después del límite de 60 segundos.');
    if (!choice && seconds !== 60) throw new Error('Solo se acepta una respuesta en blanco cuando se agota el minuto.');
    const result = !choice ? 'TIMEOUT' : choice === question.CORRECTA ? 'OK' : 'ERROR';
    if (result === 'OK') correct++; else if (result === 'ERROR') wrong++; else blank++;
    detail.push([payload.quiz, String(official.EMAIL || '').trim(), question.ID, question.BLOQUE, choice, question.CORRECTA, result, seconds]);
  });
  if (seen.size !== 20) throw new Error('El intento debe contener 20 preguntas distintas.');
  const elapsed = Number(payload.tiempoTotal);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 7200) throw new Error('La duración del intento no es válida.');
  return {student: official.ALUMNO, email: String(official.EMAIL || '').trim(), grade: {
    total: 20, aciertos: correct, errores: wrong, blanco: blank, nota: correct / 2
  }, detail: detail, elapsed: elapsed};
}
function F24_registrarDebugQuiz(payload) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(F24_DEBUG_SPREADSHEET_ID);
    const resultSheet = ss.getSheetByName('QUIZ_RESULTADOS');
    const detailSheet = ss.getSheetByName('QUIZ_RESPUESTAS');
    const expected = ['FECHA','QUIZ','ALUMNO','EMAIL','GRUPO','PREGUNTAS','ACIERTOS','ERRORES','BLANCO','NOTA','TIEMPO'];
    const expectedDetail = ['FECHA','QUIZ','EMAIL','PREGUNTA_ID','BLOQUE','RESPUESTA','CORRECTA','RESULTADO','SEGUNDOS'];
    if (!resultSheet || !detailSheet ||
        JSON.stringify(resultSheet.getRange(1, 1, 1, 11).getValues()[0]) !== JSON.stringify(expected) ||
        JSON.stringify(detailSheet.getRange(1, 1, 1, 9).getValues()[0]) !== JSON.stringify(expectedDetail)) {
      throw new Error('Las cabeceras del registro de notas no coinciden.');
    }
    const prepared = F24_debugPrepare_(payload,
      F24_debugTable_(ss.getSheetByName('QUIZ_PREGUNTAS')),
      F24_debugTable_(ss.getSheetByName('ALUMNOS')),
      F24_debugTable_(ss.getSheetByName('QUIZ_CONFIG')));
    const canonical = JSON.stringify([payload.quiz, payload.attemptId, payload.alumno, payload.respuestas]);
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical)
      .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
    const prefix = payload.quiz + ':' + payload.attemptId + ':', note = prefix + hash;
    if (resultSheet.getLastRow() > 1) {
      const notes = resultSheet.getRange(2, 1, resultSheet.getLastRow() - 1, 1).getNotes();
      const found = notes.findIndex(row => String(row[0]).startsWith(prefix));
      if (found !== -1) {
        if (notes[found][0] !== note) throw new Error('Este intento ya se registró con respuestas diferentes.');
        const old = resultSheet.getRange(found + 2, 1, 1, 11).getValues()[0];
        return {total: old[5], aciertos: old[6], errores: old[7], blanco: old[8], nota: old[9], attemptId: payload.attemptId, duplicado: true};
      }
    }
    const now = new Date();
    const serial = now.getTime() / 86400000 + 25569;
    const grade = prepared.grade;
    const summary = [serial, payload.quiz, prepared.student, prepared.email, '1SI-JAVA', 20,
      grade.aciertos, grade.errores, grade.blanco, grade.nota, prepared.elapsed];
    const cell = values => values.map(value => ({userEnteredValue:
      typeof value === 'number' ? {numberValue: value} : {stringValue: String(value)}}));
    const summaryCells = cell(summary);
    summaryCells[0].note = note;
    summaryCells[0].userEnteredFormat = {numberFormat: {type:'DATE_TIME', pattern:'yyyy-mm-dd hh:mm:ss'}};
    const dateFormat = {numberFormat: {type:'DATE_TIME', pattern:'yyyy-mm-dd hh:mm:ss'}};
    const details = prepared.detail.map(row => {
      const cells = cell([serial].concat(row)); cells[0].userEnteredFormat = dateFormat; return {values:cells};
    });
    const requests = [
      {appendCells:{sheetId:resultSheet.getSheetId(),rows:[{values:summaryCells}],fields:'userEnteredValue,note,userEnteredFormat.numberFormat'}},
      {appendCells:{sheetId:detailSheet.getSheetId(),rows:details,fields:'userEnteredValue,userEnteredFormat.numberFormat'}}
    ];
    const response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + F24_DEBUG_SPREADSHEET_ID + ':batchUpdate', {
      method:'post', contentType:'application/json', headers:{Authorization:'Bearer ' + ScriptApp.getOAuthToken()},
      payload:JSON.stringify({requests:requests}), muteHttpExceptions:true
    });
    if (response.getResponseCode() !== 200) throw new Error('No se pudo confirmar el registro de la nota.');
    return Object.assign({}, grade, {attemptId:payload.attemptId, duplicado:false});
  } finally { lock.releaseLock(); }
}
