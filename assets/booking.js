(function () {
  'use strict';

  var CFG = window.PYUANA_CONFIG || {};

  // 料金（税込）。変えるときは gas/Code.gs の PRICES も同じ値にしてください。
  var PRICES = {
    basePeak: 8000,      // 通常エアコン 1台目（4〜10月）
    baseOff: 6000,       // 通常エアコン 1台目（11〜3月）
    multiDiscount: 3000, // 同日2台目以降の割引（1台あたり）
    autoClean: 5000,
    tenkase: 14400,
    highPlace: 3000,
    nanosol: 2500,
    outdoor: 4000,
    set: 5000,
    drain: 2500
  };
  var LABELS = {
    autoClean: 'お掃除機能付き', tenkase: '天カセ', highPlace: '高所（2.3m以上）',
    set: 'おまとめセット', nanosol: 'ナノソル除菌コート', outdoor: '室外機清掃', drain: 'ドレンホース洗浄'
  };
  var TIMES = ['9時〜12時', '12時〜15時', '15時〜18時', '上記以外で相談したい'];
  var PREFS = '北海道,青森県,岩手県,宮城県,秋田県,山形県,福島県,茨城県,栃木県,群馬県,埼玉県,千葉県,東京都,神奈川県,新潟県,富山県,石川県,福井県,山梨県,長野県,岐阜県,静岡県,愛知県,三重県,滋賀県,京都府,大阪府,兵庫県,奈良県,和歌山県,鳥取県,島根県,岡山県,広島県,山口県,徳島県,香川県,愛媛県,高知県,福岡県,佐賀県,長崎県,熊本県,大分県,宮崎県,鹿児島県,沖縄県'.split(',');

  var ROUTE_KEY = 'pyuana-route';
  var ROUTE_DAYS = 90;

  var state = { units: 1, autoClean: 0, tenkase: 0, highPlace: 0, set: 0, nanosol: 0, outdoor: 0, drain: 0 };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yen = function (n) { return '¥' + Number(n).toLocaleString('ja-JP'); };

  // ---- 初期表示 ----
  $$('[data-shop]').forEach(function (el) { if (CFG.SHOP_NAME) el.textContent = CFG.SHOP_NAME; });
  if (CFG.PHONE) {
    $('#phoneLine').hidden = false;
    $('#phoneLink').textContent = CFG.PHONE;
    $('#phoneLink').href = 'tel:' + CFG.PHONE.replace(/[^\d+]/g, '');
  }
  if (!CFG.GAS_URL) $('#testBanner').hidden = false;

  // 開いた時点でURLの経路を保存し、紹介コードがあれば入力欄にも入れておく
  var firstRoute = route();
  if (firstRoute.ref && !$('#referral').value) $('#referral').value = firstRoute.ref;

  var prefSel = $('#pref');
  PREFS.forEach(function (p) { var o = document.createElement('option'); o.textContent = p; prefSel.appendChild(o); });

  var minDate = new Date();
  minDate.setDate(minDate.getDate() + 2);
  var minStr = toISO(minDate);
  var wishes = $('#wishes');
  [1, 2, 3].forEach(function (i) {
    var div = document.createElement('div');
    div.className = 'wish';
    div.innerHTML =
      '<div class="num">第' + i + '希望<span class="req">必須</span></div>' +
      '<div><label class="hint" for="date' + i + '">日付</label><input type="date" id="date' + i + '" name="date' + i + '" min="' + minStr + '" required></div>' +
      '<div><label class="hint" for="time' + i + '">時間帯</label><select id="time' + i + '" name="time' + i + '" required><option value="">選択してください</option>' +
      TIMES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>';
    wishes.appendChild(div);
  });
  $('#date1').addEventListener('change', render);

  // ---- 台数カウンター ----
  function maxFor(key) {
    var u = state.units;
    if (key === 'units') return 20;
    if (key === 'set') return u - Math.max(state.nanosol, state.outdoor);
    if (key === 'nanosol' || key === 'outdoor') return u - state.set;
    return u;
  }
  function minFor(key) { return key === 'units' ? 1 : 0; }

  $$('.counter').forEach(function (row) {
    var key = row.getAttribute('data-key');
    $('[data-inc]', row).addEventListener('click', function () { change(key, 1); });
    $('[data-dec]', row).addEventListener('click', function () { change(key, -1); });
  });

  function change(key, delta) {
    var v = state[key] + delta;
    if (v < minFor(key) || v > maxFor(key)) return;
    state[key] = v;
    if (key === 'units') {
      ['autoClean', 'tenkase', 'highPlace', 'drain', 'set'].forEach(function (k) { state[k] = Math.min(state[k], state.units); });
      state.nanosol = Math.min(state.nanosol, state.units - state.set);
      state.outdoor = Math.min(state.outdoor, state.units - state.set);
    }
    render();
  }

  // ---- 料金計算（gas/Code.gs の calcPrice_ と同じ計算）----
  function calcPrice() {
    var d1 = $('#date1').value;
    var month = /^\d{4}-\d{2}-\d{2}$/.test(d1) ? Number(d1.slice(5, 7)) : new Date().getMonth() + 1;
    var peak = month >= 4 && month <= 10;
    var base = peak ? PRICES.basePeak : PRICES.baseOff;
    var lines = [['エアコン ' + state.units + '台', base * state.units - PRICES.multiDiscount * (state.units - 1)]];
    var total = lines[0][1];
    Object.keys(LABELS).forEach(function (k) {
      if (state[k]) {
        var amt = PRICES[k] * state[k];
        lines.push([LABELS[k] + ' ×' + state[k], amt]);
        total += amt;
      }
    });
    return { peak: peak, base: base, total: total, lines: lines };
  }

  function render() {
    $$('.counter').forEach(function (row) {
      var key = row.getAttribute('data-key');
      $('output', row).textContent = state[key];
      $('[data-dec]', row).disabled = state[key] <= minFor(key);
      $('[data-inc]', row).disabled = state[key] >= maxFor(key);
    });
    var p = calcPrice();
    $('[data-base-label]').textContent = '1台目 ' + p.base.toLocaleString() + '円／同日2台目以降 ' + (p.base - PRICES.multiDiscount).toLocaleString() + '円';
    $('#seasonLabel').textContent = p.peak ? '繁忙期料金（4〜10月）' : '閑散期料金（11〜3月）';
    $('#totalAmount').textContent = yen(p.total);
    $('#stickyAmount').textContent = yen(p.total);
    $('#breakdown').innerHTML = p.lines.map(function (l) { return '<li><span>' + l[0] + '</span><span>' + yen(l[1]) + '</span></li>'; }).join('');
  }
  render();

  // 予約フォームの下までスクロールしたら固定バーを隠す
  var bar = $('#stickyBar');
  $('#stickyLink').addEventListener('click', function (e) {
    e.preventDefault();
    $('#name').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { bar.hidden = es[0].isIntersecting; }).observe($('#submitBtn'));
  }

  // ---- 送信 ----
  var form = $('#bookingForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#errorBox');
    err.textContent = '';
    var bad = validate();
    if (bad.length) {
      err.textContent = '未入力または入力に誤りがある項目があります：' + bad.map(function (b) { return b.label; }).join('、');
      bad[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var data = collect();
    var btn = $('#submitBtn');
    btn.disabled = true;
    btn.textContent = '送信しています…';

    send(data).then(function (res) {
      if (!res.ok) throw new Error(res.error || '送信に失敗しました。');
      form.hidden = true;
      bar.hidden = true;
      $('#doneId').textContent = res.id;
      $('#doneView').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function (ex) {
      err.textContent = ex.message || '送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。';
      btn.disabled = false;
      btn.textContent = 'この内容で予約する';
    });
  });

  function send(data) {
    if (!CFG.GAS_URL) {
      console.log('テストモード：送信内容', data);
      return new Promise(function (r) { setTimeout(function () { r({ ok: true, id: 'TEST-0000' }); }, 600); });
    }
    return fetch(CFG.GAS_URL, { method: 'POST', body: JSON.stringify(data) }).then(function (r) { return r.json(); });
  }

  function validate() {
    var bad = [];
    $$('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
    var need = [
      ['name', 'お名前'], ['tel', '電話番号'], ['email', 'メールアドレス'], ['pref', '都道府県'], ['address', 'ご住所'],
      ['date1', '第1希望日'], ['time1', '第1希望時間'], ['date2', '第2希望日'], ['time2', '第2希望時間'],
      ['date3', '第3希望日'], ['time3', '第3希望時間'], ['source', '知ったきっかけ']
    ];
    need.forEach(function (n) {
      var el = $('#' + n[0]);
      if (!el.value.trim()) { el.classList.add('invalid'); bad.push({ el: el, label: n[1] }); }
    });
    var email = $('#email');
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.classList.add('invalid'); bad.push({ el: email, label: 'メールアドレスの形式' });
    }
    var tel = $('#tel');
    if (tel.value && !/^[0-9０-９\-－ー() ]{10,15}$/.test(tel.value.trim())) {
      tel.classList.add('invalid'); bad.push({ el: tel, label: '電話番号の形式' });
    }
    [1, 2, 3].forEach(function (i) {
      var el = $('#date' + i);
      if (el.value && el.value < minStr) { el.classList.add('invalid'); bad.push({ el: el, label: '第' + i + '希望日（' + minStr.replace(/-/g, '/') + '以降）' }); }
    });
    [['houseType', 'お住まいのタイプ'], ['payment', 'お支払い方法'], ['parking', '駐車場']].forEach(function (g) {
      if (!$('input[name="' + g[0] + '"]:checked')) {
        var box = $('input[name="' + g[0] + '"]').closest('.choices');
        bad.push({ el: box, label: g[1] });
      }
    });
    if (!$('#agree').checked) bad.push({ el: $('#agree'), label: 'ご確認事項への同意' });
    return bad;
  }

  function collect() {
    var v = function (id) { return $('#' + id).value.trim(); };
    var radio = function (n) { var el = $('input[name="' + n + '"]:checked'); return el ? el.value : ''; };
    var checks = function (n) { return $$('input[name="' + n + '"]:checked').map(function (el) { return el.value; }); };
    var data = {
      type: 'booking',
      name: v('name'), tel: v('tel'), email: v('email'), zip: v('zip'), pref: v('pref'), address: v('address'),
      houseType: radio('houseType'),
      date1: v('date1'), time1: v('time1'), date2: v('date2'), time2: v('time2'), date3: v('date3'), time3: v('time3'),
      payment: radio('payment'), parking: radio('parking'), otherCleaning: checks('otherCleaning'),
      maker: v('maker'), age: v('age'), lastCleaning: v('lastCleaning'), symptoms: checks('symptoms'),
      source: v('source'), referral: v('referral'), note: v('note'),
      agree: $('#agree').checked, newsletter: $('#newsletter').checked,
      website: $('input[name="website"]').value,
      estimate: calcPrice().total
    };
    var r = route();
    data.storeCode = clean(CFG.STORE_CODE);
    data.utmSource = r.utm_source;
    data.utmMedium = r.utm_medium;
    data.utmCampaign = r.utm_campaign;
    data.referrerHost = r.referrerHost;
    if (!data.referral && r.ref) data.referral = r.ref;
    Object.keys(state).forEach(function (k) { data[k] = state[k]; });
    return data;
  }

  // ---- 経路（どこから来た予約か）----
  // URLの ?ref= ?utm_source= ?utm_medium= ?utm_campaign= を読み、90日間この端末に保存する。
  // お客様には入力させない。値は英数字・_・- だけにして40文字までに切る。
  function clean(v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }

  function route() {
    var keys = ['ref', 'utm_source', 'utm_medium', 'utm_campaign'];
    var out = { ref: '', utm_source: '', utm_medium: '', utm_campaign: '', referrerHost: '' };
    var now = Date.now();
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(ROUTE_KEY) || '{}') || {}; } catch (e) { saved = {}; }
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { q = { get: function () { return null; } }; }
    keys.forEach(function (k) {
      var fromUrl = clean(q.get(k));
      if (fromUrl) {
        saved[k] = { v: fromUrl, t: now };
      } else if (saved[k] && now - saved[k].t > ROUTE_DAYS * 864e5) {
        delete saved[k];
      }
      out[k] = saved[k] ? saved[k].v : '';
    });
    try { localStorage.setItem(ROUTE_KEY, JSON.stringify(saved)); } catch (e) { /* 保存できなくても予約は続ける */ }
    try {
      if (document.referrer) {
        var host = new URL(document.referrer).hostname;
        if (host && host !== location.hostname) out.referrerHost = host.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 60);
      }
    } catch (e) { /* 何もしない */ }
    return out;
  }

  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
})();
