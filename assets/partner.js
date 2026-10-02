(function () {
  'use strict';

  var CFG = window.PYUANA_CONFIG || {};
  var STORE_KEY = 'pyuana-partner';
  var PREFS = '北海道,青森県,岩手県,宮城県,秋田県,山形県,福島県,茨城県,栃木県,群馬県,埼玉県,千葉県,東京都,神奈川県,新潟県,富山県,石川県,福井県,山梨県,長野県,岐阜県,静岡県,愛知県,三重県,滋賀県,京都府,大阪府,兵庫県,奈良県,和歌山県,鳥取県,島根県,岡山県,広島県,山口県,徳島県,香川県,愛媛県,高知県,福岡県,佐賀県,長崎県,熊本県,大分県,宮崎県,鹿児島県,沖縄県'.split(',');
  var $ = function (s) { return document.querySelector(s); };

  document.querySelectorAll('[data-shop]').forEach(function (el) { if (CFG.SHOP_NAME) el.textContent = CFG.SHOP_NAME; });
  if (!CFG.GAS_URL) $('#testBanner').hidden = false;
  PREFS.forEach(function (p) { var o = document.createElement('option'); o.textContent = p; $('#pref').appendChild(o); });

  // 保存した提携コード・担当者名を読み込む（保存できない環境でも動くようにする）
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) {
      $('#partnerCode').value = saved.partnerCode || '';
      $('#staff').value = saved.staff || '';
      $('#email').value = saved.email || '';
      $('#remember').checked = true;
    }
  } catch (e) { /* 何もしない */ }

  var form = $('#partnerForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#errorBox');
    err.textContent = '';
    var missing = [['partnerCode', '提携コード'], ['staff', '担当者名'], ['workDate', '作業日'], ['work', '作業内容'], ['amount', '売上金額']]
      .filter(function (f) { var el = $('#' + f[0]); el.classList.toggle('invalid', !el.value.trim()); return !el.value.trim(); });
    if (missing.length) {
      err.textContent = '未入力の項目があります：' + missing.map(function (m) { return m[1]; }).join('、');
      return;
    }
    var v = function (id) { return $('#' + id).value.trim(); };
    var data = {
      type: 'partner',
      partnerCode: v('partnerCode'), staff: v('staff'), email: v('email'),
      workDate: v('workDate'), pref: v('pref'), work: v('work'), units: v('units'),
      amount: v('amount'), fee: v('fee'), note: v('note'),
      website: document.querySelector('input[name="website"]').value
    };

    try {
      if ($('#remember').checked) localStorage.setItem(STORE_KEY, JSON.stringify({ partnerCode: data.partnerCode, staff: data.staff, email: data.email }));
      else localStorage.removeItem(STORE_KEY);
    } catch (ex) { /* 保存できなくても送信は続ける */ }

    var btn = $('#submitBtn');
    btn.disabled = true;
    btn.textContent = '送信しています…';
    var req = CFG.GAS_URL
      ? fetch(CFG.GAS_URL, { method: 'POST', body: JSON.stringify(data) }).then(function (r) { return r.json(); })
      : new Promise(function (r) { console.log('テストモード：送信内容', data); setTimeout(function () { r({ ok: true, id: 'TEST-0000' }); }, 600); });

    req.then(function (res) {
      if (!res.ok) throw new Error(res.error || '送信に失敗しました。');
      form.hidden = true;
      $('#doneId').textContent = res.id;
      $('#doneView').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function (ex) {
      err.textContent = ex.message || '送信に失敗しました。もう一度お試しください。';
    }).then(function () {
      btn.disabled = false;
      btn.textContent = '売上を報告する';
    });
  });

  $('#againBtn').addEventListener('click', function () {
    ['workDate', 'pref', 'work', 'units', 'amount', 'fee', 'note'].forEach(function (id) { $('#' + id).value = ''; });
    $('#doneView').hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
