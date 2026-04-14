/**
 * anamnesis.js — логика 5-шагового мастера заполнения анамнеза
 */

const state = {
  currentStep: 1,
  pain_area: null,
  pain_area_label: null,
  pain_level: 5,
  symptoms: [],
  additional_info: '',
  symptomsLoaded: false
};

// ─── STEP NAVIGATION ──────────────────────────────────────────────────────────

function goToStep(n) {
  if (n === 2 && !state.pain_area) {
    alert('Пожалуйста, выберите область боли');
    return;
  }
  if (n === 3) {
    state.pain_level = parseInt(document.getElementById('pain-slider').value);
    loadSymptoms();
  }
  if (n === 5) {
    state.additional_info = document.getElementById('additional-info').value;
    renderSummary();
  }

  document.querySelectorAll('.anamnesis-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + n).classList.add('active');
  state.currentStep = n;
  updateStepIndicators();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicators() {
  document.querySelectorAll('.step').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if (s === state.currentStep) el.classList.add('active');
    if (s < state.currentStep) el.classList.add('done');
  });
  document.querySelectorAll('.step-line').forEach((line, i) => {
    line.classList.toggle('done', i < state.currentStep - 1);
  });
}

// ─── STEP 1: AREA SELECTION ───────────────────────────────────────────────────

function selectArea(key, label) {
  state.pain_area = key;
  state.pain_area_label = label;
  state.symptomsLoaded = false;

  // Update display
  document.getElementById('selected-area-display').style.display = 'flex';
  document.getElementById('selected-area-text').textContent = label;

  // Highlight button
  document.querySelectorAll('.area-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.area === key);
  });

  // Enable next button
  document.getElementById('btn-step2').disabled = false;

  // Sync 3D model
  if (typeof window.highlightBodyPart === 'function') {
    window.highlightBodyPart(key);
  }
}

// ─── STEP 2: PAIN LEVEL ───────────────────────────────────────────────────────

const PAIN_LABELS = [
  '', 'Практически нет боли', 'Очень слабая', 'Слабая',
  'Умеренно-слабая', 'Умеренная', 'Умеренно-сильная',
  'Сильная', 'Очень сильная', 'Нестерпимая', 'Невыносимая'
];

function updatePainDisplay(val) {
  document.getElementById('pain-number').textContent = val;
  document.getElementById('pain-label').textContent = PAIN_LABELS[val] || '';
  state.pain_level = parseInt(val);

  const slider = document.getElementById('pain-slider');
  const pct = (val - 1) / 9;
  const r = Math.round(pct * 255);
  const g = Math.round((1 - pct) * 200);
  slider.style.setProperty('--thumb-color', `rgb(${r},${g},50)`);
}

// ─── STEP 3: SYMPTOMS ─────────────────────────────────────────────────────────

async function loadSymptoms() {
  if (state.symptomsLoaded) return;
  const listEl = document.getElementById('symptoms-list');
  const loadingEl = document.getElementById('loading-symptoms');

  listEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try {
    const res = await fetch('/api/anamnesis/symptoms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pain_area: state.pain_area })
    });
    const data = await res.json();

    listEl.innerHTML = '';
    data.symptoms.forEach(s => {
      const checked = state.symptoms.includes(s);
      const label = document.createElement('label');
      label.className = 'symptom-checkbox' + (checked ? ' checked' : '');
      label.innerHTML = `
        <input type="checkbox" value="${s}" ${checked ? 'checked' : ''} onchange="toggleSymptom(this, '${s.replace(/'/g, "\\'")}')">
        <span class="symptom-text">${s}</span>
      `;
      listEl.appendChild(label);
    });

    document.getElementById('symptoms-subtitle').textContent =
      `ИИ предлагает симптомы для области: ${data.label}`;

    loadingEl.style.display = 'none';
    listEl.style.display = 'grid';
    state.symptomsLoaded = true;
  } catch (e) {
    loadingEl.innerHTML = '<p style="color:#ef4444;">Ошибка загрузки симптомов. Попробуйте снова.</p>';
  }
}

function toggleSymptom(checkbox, name) {
  const label = checkbox.closest('.symptom-checkbox');
  if (checkbox.checked) {
    if (!state.symptoms.includes(name)) state.symptoms.push(name);
    label.classList.add('checked');
  } else {
    state.symptoms = state.symptoms.filter(s => s !== name);
    label.classList.remove('checked');
  }
}

// ─── STEP 5: SUMMARY ─────────────────────────────────────────────────────────

function renderSummary() {
  document.getElementById('sum-area').textContent = state.pain_area_label || '—';
  document.getElementById('sum-pain').textContent = state.pain_level + ' / 10 — ' + (PAIN_LABELS[state.pain_level] || '');
  document.getElementById('sum-symptoms').textContent =
    state.symptoms.length > 0 ? state.symptoms.join(', ') : 'Не выбраны';
  document.getElementById('sum-info').textContent =
    state.additional_info.trim() || 'Не указана';
}

// ─── SUBMIT ───────────────────────────────────────────────────────────────────

async function submitAnamnesis() {
  const btn = document.getElementById('btn-submit');
  const errorEl = document.getElementById('submit-error');
  const successEl = document.getElementById('submit-success');

  btn.disabled = true;
  btn.textContent = 'Сохраняем...';
  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/anamnesis/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: APPOINTMENT_ID,
        pain_area: state.pain_area,
        pain_level: state.pain_level,
        symptoms: state.symptoms,
        additional_info: state.additional_info
      })
    });
    const data = await res.json();
    if (data.success) {
      successEl.style.display = 'block';
      document.getElementById('btn-back-5').style.display = 'none';
      btn.style.display = 'none';
      setTimeout(() => { window.location.href = '/patient/dashboard'; }, 2500);
    } else {
      throw new Error(data.error || 'Ошибка сохранения');
    }
  } catch (e) {
    errorEl.textContent = 'Ошибка: ' + e.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Подтвердить и отправить';
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Restore from existing anamnesis
  if (typeof EXISTING !== 'undefined' && EXISTING) {
    state.pain_area = EXISTING.pain_area;
    state.pain_area_label = EXISTING.pain_area_label;
    state.pain_level = EXISTING.pain_level;
    state.symptoms = EXISTING.symptoms || [];
    state.additional_info = EXISTING.additional_info || '';

    if (state.pain_area) {
      document.getElementById('selected-area-display').style.display = 'flex';
      document.getElementById('selected-area-text').textContent = state.pain_area_label;
      document.getElementById('btn-step2').disabled = false;
      document.querySelectorAll('.area-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.area === state.pain_area);
      });
    }
    const slider = document.getElementById('pain-slider');
    if (slider) {
      slider.value = state.pain_level;
      updatePainDisplay(state.pain_level);
    }
    if (state.additional_info) {
      const ta = document.getElementById('additional-info');
      if (ta) ta.value = state.additional_info;
    }
  }

  // Init pain display
  updatePainDisplay(document.getElementById('pain-slider')?.value || 5);
  updateStepIndicators();
});
