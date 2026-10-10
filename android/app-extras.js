(function () {
  'use strict';
  var KEY = 'est60_app_profile_v1';
  var TASKS_KEY = 'est60_app_tasks_v1';
  var DONE_KEY = 'est60_app_done_public_v1';
  var ALERTS_KEY = 'est60_app_alerts_seen_v1';
  var defaults = { name: '', theme: 'dark', favorites: ['Inglés', 'Tecnología'] };
  function read(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { if (ch === '&') return '&amp;'; if (ch === '<') return '&lt;'; if (ch === '>') return '&gt;'; if (ch === '"') return '&quot;'; return '&#39;'; }); }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function dateLabel(value) { if (!value) return 'Sin fecha'; var d = new Date(value + (String(value).length === 10 ? 'T12:00:00' : '')); return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}); }
  var profile = Object.assign({}, defaults, read(KEY, {}));
  var personalTasks = read(TASKS_KEY, []);
  var completedPublic = read(DONE_KEY, []);
  var seenAlerts = read(ALERTS_KEY, []);
  var root;
  function createPanel() {
    if (document.getElementById('est60AppSpace')) return;
    /* Los estilos exclusivos se cargan desde app-extras.css. */
    root = document.createElement('section'); root.id = 'est60AppSpace'; root.className = 'est60-app-space';
    root.innerHTML = '<div class="ea-top"><div><span class="ea-kicker">EXCLUSIVO DE LA APP</span><h2>Mi espacio <span>1°D</span></h2><p id="eaGreeting">Tu centro personal para la escuela.</p></div><button type="button" id="eaSettingsOpen" class="ea-icon-btn" aria-label="Personalizar">⚙</button></div>' +
      '<div class="ea-profile"><div class="ea-avatar" id="eaAvatar">1D</div><div class="ea-profile-text"><strong id="eaProfileName">Alumno de 1°D</strong><span>Tu panel personal · se guarda en este celular</span></div><button type="button" id="eaEditProfile" class="ea-quiet-btn">Editar</button></div>' +
      '<div class="ea-feature-grid"><article class="ea-feature-card ea-id-card"><div class="ea-feature-heading"><div><span class="ea-kicker">IDENTIFICACIÓN PERSONAL</span><h3>Mi credencial digital</h3></div><span class="ea-id-chip">1°D</span></div><div class="ea-id-layout"><div class="ea-id-mini-avatar" id="eaIdAvatar">1D</div><div class="ea-id-info"><strong id="eaIdName">Alumno de 1°D</strong><span>Escuela Secundaria Técnica No. 60</span><small id="eaIdCode">Código local: —</small></div><div class="ea-qr-wrap"><img id="eaProfileQr" alt="Código QR de perfil" loading="lazy"><span>QR de perfil</span></div></div><p class="ea-id-disclaimer">Identificación personal dentro de la app; no es una credencial oficial ni verifica identidad.</p><button type="button" id="eaCopyIdCode" class="ea-quiet-btn">Copiar código</button></article><article class="ea-feature-card"><div class="ea-feature-heading"><div><span class="ea-kicker">PROGRESO PERSONAL</span><h3>Mis logros</h3></div><span class="ea-achievement-count" id="eaAchievementCount">0/6</span></div><p class="ea-feature-description">Se desbloquean al usar las funciones de tu espacio personal.</p><div id="eaAchievements" class="ea-achievements"></div></article></div>' +
      '<div class="ea-feature-card ea-suggestion-card"><div class="ea-feature-heading"><div><span class="ea-kicker">TU OPINIÓN CUENTA</span><h3>Buzón de sugerencias</h3></div><span class="ea-suggestion-mark">IDEAS</span></div><p class="ea-feature-description">Escribe una idea para mejorar la app o proponer una actividad para el grupo.</p><form id="eaSuggestionForm" class="ea-suggestion-form"><label>Tipo de sugerencia<select id="eaSuggestionCategory"><option value="Mejora de la app">Mejora de la app</option><option value="Actividad del grupo">Actividad del grupo</option><option value="Contenido escolar">Contenido escolar</option><option value="Otra">Otra</option></select></label><label>Tu sugerencia<textarea id="eaSuggestionText" maxlength="500" required rows="3" placeholder="Describe tu idea (máximo 500 caracteres)…"></textarea></label><div class="ea-suggestion-bottom"><small><span id="eaSuggestionChars">0</span>/500 · No incluyas datos personales.</small><button type="submit" class="ea-primary-btn">Guardar sugerencia</button></div></form><div id="eaSuggestionList" class="ea-suggestion-list"></div><p class="ea-suggestion-notice">Por ahora las sugerencias se guardan solo en este dispositivo; no se envían al profesor ni a otros compañeros.</p></div>' +
      '<article class="ea-feature-card ea-suggestion-card"><div class="ea-feature-heading"><div><span class="ea-kicker">ACCESO AL CHAT</span><h3>Solicitar credencial</h3></div><span class="ea-id-chip">REVISIÓN</span></div><p class="ea-feature-description">Un administrador revisará manualmente la foto. Tómala con buena luz, de frente y con el uniforme visible. No incluyas a otras personas ni datos privados en la imagen.</p><form id="eaCredentialForm" class="ea-suggestion-form"><label>Correo escolar<input id="eaCredentialEmail" type="email" maxlength="254" required placeholder="tu correo institucional"></label><label>Apodo para el chat<input id="eaCredentialNickname" maxlength="32" minlength="2" required placeholder="Cómo te verán tus compañeros"></label><label>Edad<select id="eaCredentialAge" required><option value="">Selecciona tu edad</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option></select></label><label>Foto con uniforme<input id="eaCredentialPhoto" type="file" accept="image/jpeg,image/png,image/webp" required></label><label class="ea-consent-label"><input id="eaCredentialConsent" type="checkbox" required> Mi padre, madre o tutor autorizó esta solicitud y la revisión privada de la foto.</label><button type="submit" class="ea-primary-btn">Enviar solicitud</button><p id="eaCredentialStatus" role="status" aria-live="polite"></p></form><p class="ea-suggestion-notice">No escribas tu nombre legal. La foto se elimina cuando se aprueba o rechaza la solicitud. El envío permanece pausado hasta que un adulto responsable autorice activar el sistema.</p></article>' +
      '<div class="ea-stats"><div><span>Tareas personales</span><strong id="eaTaskCount">0</strong></div><div><span>Por completar</span><strong id="eaPendingCount">0</strong></div><div><span>Avisos nuevos</span><strong id="eaAlertCount">0</strong></div></div>' +
      '<div class="ea-card ea-now"><div class="ea-card-heading"><span class="ea-kicker">HORARIO INTELIGENTE</span><span class="ea-live-dot"></span></div><strong id="eaCurrentClass">Consultando horario…</strong><p id="eaCurrentMessage">Se actualizará al leer el horario del grupo.</p><div class="ea-next"><span>PRÓXIMA CLASE</span><strong id="eaNextClass">Calculando…</strong><small id="eaNextTime">Consulta el horario completo abajo.</small></div><button type="button" class="ea-link-btn" data-target="horario">Abrir horario completo →</button></div>' +
      '<div class="ea-section-title"><div><span class="ea-kicker">ORGANÍZATE</span><h3>Mis tareas</h3></div><button type="button" id="eaAddTaskOpen" class="ea-primary-btn">+ Añadir</button></div>' +
      '<form id="eaTaskForm" class="ea-task-form" hidden><label>¿Qué tienes que hacer?<input id="eaTaskTitle" maxlength="120" required placeholder="Ej. Terminar actividad de Geografía"></label><div class="ea-form-row"><label>Materia<input id="eaTaskSubject" maxlength="50" placeholder="Geografía"></label><label>Entrega<input id="eaTaskDate" type="date"></label></div><div class="ea-form-actions"><button type="button" id="eaCancelTask" class="ea-quiet-btn">Cancelar</button><button class="ea-primary-btn" type="submit">Guardar tarea</button></div></form>' +
      '<div id="eaTaskList" class="ea-task-list"></div><div class="ea-empty" id="eaTaskEmpty">Todavía no agregas tareas personales. Puedes guardar trabajos aquí y marcarlos cuando termines.</div>' +
      '<div class="ea-section-title ea-notice-title"><div><span class="ea-kicker">CENTRO DE AVISOS</span><h3>Novedades del grupo</h3></div><div class="ea-notice-actions"><button type="button" id="eaMarkAllRead" class="ea-quiet-btn">Marcar todo leído</button><button type="button" id="eaRefresh" class="ea-quiet-btn">Actualizar</button></div></div><div id="eaNoticeList" class="ea-notice-list"></div>' +
      '<div class="ea-section-title"><div><span class="ea-kicker">A TU MANERA</span><h3>Personalización</h3></div></div><div class="ea-settings"><div class="ea-photo-setting"><label>Foto de perfil<input id="eaAvatarInput" type="file" accept="image/*"></label><button type="button" id="eaRemoveAvatar" class="ea-quiet-btn">Quitar foto</button></div><label>Cómo quieres que te llamemos<input id="eaNameInput" maxlength="32" placeholder="Tu apodo"></label><label>Tema de la app<select id="eaThemeSelect"><option value="dark">Azul oscuro</option><option value="light">Claro</option></select></label><div class="ea-fav-wrap"><span>Materias favoritas</span><div id="eaFavorites" class="ea-favorites"></div></div><button type="button" id="eaSaveSettings" class="ea-primary-btn">Guardar preferencias</button><p id="eaSaveMessage" role="status"></p></div>' +
      '<div class="ea-offline-note"><span>✓</span><p><strong>Tus datos personales se quedan en este dispositivo.</strong><br>Las tareas, el apodo, el tema y las materias favoritas se conservan sin conexión. Los avisos del grupo se actualizan cuando hay internet y pueden mostrarse desde la última copia guardada.</p></div>' +
      '<div class="ea-bottom-links"><button type="button" data-target="avisos">Avisos del grupo</button><button type="button" data-target="tareas">Tareas públicas</button><button type="button" data-target="calendario">Calendario</button></div>';
    var main = document.querySelector('main'); if (main) main.insertBefore(root, main.firstChild);
    root.querySelector('#eaCredentialForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      var status = root.querySelector('#eaCredentialStatus');
      var submit = event.submitter || root.querySelector('#eaCredentialForm button[type="submit"]');
      var email = root.querySelector('#eaCredentialEmail').value.trim().toLowerCase();
      var nickname = root.querySelector('#eaCredentialNickname').value.trim();
      var age = Number(root.querySelector('#eaCredentialAge').value);
      var file = root.querySelector('#eaCredentialPhoto').files[0];
      if (!/^[^\s@]+@chih\.nuevaescuela\.mx$/i.test(email)) { status.textContent = 'Usa tu correo escolar terminado en @chih.nuevaescuela.mx.'; return; }
      if (!file) { status.textContent = 'Selecciona una foto con buena luz y el uniforme visible.'; return; }
      if (!root.querySelector('#eaCredentialConsent').checked) { status.textContent = 'Necesitas autorización de tu padre, madre o tutor.'; return; }
      submit.disabled = true; status.textContent = 'Preparando la foto…';
      try {
        var photo = await new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.onerror = function(){ reject(new Error('No se pudo leer la foto.')); };
          reader.onload = function() {
            var image = new Image();
            image.onerror = function(){ reject(new Error('La foto no se pudo abrir.')); };
            image.onload = function() {
              var scale = Math.min(1, 1280 / Math.max(image.width, image.height));
              var canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(image.width * scale));
              canvas.height = Math.max(1, Math.round(image.height * scale));
              var context = canvas.getContext('2d');
              context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              var result = canvas.toDataURL('image/jpeg', 0.72);
              if (result.length > 1450000) result = canvas.toDataURL('image/jpeg', 0.5);
              if (result.length > 1450000) reject(new Error('La foto pesa demasiado; elige otra más pequeña.'));
              else resolve(result);
            };
            image.src = reader.result;
          };
          reader.readAsDataURL(file);
        });
        status.textContent = 'Enviando solicitud…';
        var response = await fetch('https://oned-est60-server.onrender.com/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, nickname: nickname, age: age, photo: photo, guardianAuthorization: true })
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo enviar la solicitud.');
        status.textContent = data.message || 'Solicitud enviada para revisión.';
        root.querySelector('#eaCredentialForm').reset();
      } catch (error) {
        status.textContent = error.message || 'No se pudo enviar la solicitud.';
      } finally { submit.disabled = false; }
    });
    root.querySelector('#eaSettingsOpen').addEventListener('click', function () { root.querySelector('.ea-settings').scrollIntoView({behavior:'smooth',block:'center'}); root.querySelector('#eaNameInput').focus(); });
    root.querySelector('#eaEditProfile').addEventListener('click', function () { root.querySelector('.ea-settings').scrollIntoView({behavior:'smooth',block:'center'}); root.querySelector('#eaNameInput').focus(); });
    root.querySelector('#eaAddTaskOpen').addEventListener('click', function () { var f=root.querySelector('#eaTaskForm'); f.hidden=!f.hidden; if(!f.hidden) root.querySelector('#eaTaskTitle').focus(); });
    root.querySelector('#eaCancelTask').addEventListener('click', function () { root.querySelector('#eaTaskForm').hidden=true; });
    root.querySelector('#eaTaskForm').addEventListener('submit', function (event) { event.preventDefault(); var title=root.querySelector('#eaTaskTitle').value.trim(); if(!title)return; personalTasks.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:title,subject:root.querySelector('#eaTaskSubject').value.trim(),date:root.querySelector('#eaTaskDate').value,done:false,created:todayKey()}); write(TASKS_KEY,personalTasks); event.target.reset(); event.target.hidden=true; renderTasks(); renderStats(); notify('Tarea guardada','Se agregó a tu lista personal.'); });
    root.querySelector('#eaTaskList').addEventListener('change', function (event) { var id=event.target.getAttribute('data-task-done'); if(!id)return; var task=personalTasks.find(function(t){return t.id===id;}); if(task){task.done=event.target.checked;write(TASKS_KEY,personalTasks);renderTasks();renderStats();renderAchievements();} });
    root.querySelector('#eaTaskList').addEventListener('click', function (event) { var btn=event.target.closest('[data-task-delete]'); if(!btn)return; personalTasks=personalTasks.filter(function(t){return t.id!==btn.getAttribute('data-task-delete');});write(TASKS_KEY,personalTasks);renderTasks();renderStats(); });
    root.querySelector('#eaSaveSettings').addEventListener('click', saveSettings);
    root.querySelector('#eaAvatarInput').addEventListener('change', handleAvatarChange);
    root.querySelector('#eaRemoveAvatar').addEventListener('click', function(){profile.avatar='';write(KEY,profile);renderProfile();renderCredential();renderAchievements();root.querySelector('#eaAvatarInput').value='';notify('Foto eliminada','Se quitó la foto de perfil de este dispositivo.');});
    root.querySelector('#eaCopyIdCode').addEventListener('click', copyIdCode);
    root.querySelector('#eaSuggestionText').addEventListener('input', updateSuggestionChars);
    root.querySelector('#eaSuggestionForm').addEventListener('submit', saveSuggestion);
    root.querySelector('#eaSuggestionList').addEventListener('click', deleteSuggestion);
    root.querySelector('#eaRefresh').addEventListener('click', function () { refreshNotices(); notify('Centro de avisos','Se actualizaron los avisos y las tareas visibles.'); });
    root.querySelector('#eaMarkAllRead').addEventListener('click', function () { getAlerts().forEach(function(a){if(seenAlerts.indexOf(a.id)<0)seenAlerts.push(a.id);}); seenAlerts=seenAlerts.slice(-300); write(ALERTS_KEY,seenAlerts); refreshNotices(); renderStats(); notify('Centro de avisos','Todas las novedades visibles quedaron marcadas como leídas.'); });
    root.querySelector('#eaNoticeList').addEventListener('click', function(event){var button=event.target.closest('[data-alert-read]');if(!button)return;var id=button.getAttribute('data-alert-read');if(seenAlerts.indexOf(id)<0)seenAlerts.push(id);seenAlerts=seenAlerts.slice(-300);write(ALERTS_KEY,seenAlerts);refreshNotices();renderStats();});
    root.addEventListener('click', function(event){var btn=event.target.closest('[data-target]');if(!btn)return;var target=document.getElementById(btn.getAttribute('data-target'));if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
    root.querySelector('#eaNameInput').value=profile.name||''; root.querySelector('#eaThemeSelect').value=profile.theme||'dark';
    var subjects=['Español','Matemáticas','Inglés','Geografía','Ciencias','Tecnología','Historia','Artes','Educación Física','Tutoría','Formación Cívica y Ética'];
    root.querySelector('#eaFavorites').innerHTML=subjects.map(function(s){return '<label class="ea-fav"><input type="checkbox" value="'+esc(s)+'" '+(profile.favorites.indexOf(s)>=0?'checked':'')+'><span>'+esc(s)+'</span></label>';}).join('');
    if(!profile.cardCode) { profile.cardCode=Math.random().toString(36).slice(2,6).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase(); write(KEY,profile); }
    renderProfile(); renderCredential(); renderAchievements(); renderSuggestions(); updateSuggestionChars(); applyTheme(); renderTasks(); renderStats(); updateSchedule(); refreshNotices();
    var schedule=document.getElementById('smartSchedule'); if(schedule && window.MutationObserver){new MutationObserver(updateSchedule).observe(schedule,{childList:true,subtree:true,characterData:true,attributes:true});}
    var publicTasks=document.getElementById('tareasPublicas'); if(publicTasks && window.MutationObserver){new MutationObserver(function(){renderPublicTasks();renderStats();refreshNotices();}).observe(publicTasks,{childList:true,subtree:true,characterData:true});}
    var publicNotices=document.getElementById('avisosPublicos'); if(publicNotices && window.MutationObserver){new MutationObserver(function(){refreshNotices();renderStats();}).observe(publicNotices,{childList:true,subtree:true,characterData:true});}
    window.addEventListener('online', function(){root.classList.remove('ea-offline');}); window.addEventListener('offline', function(){root.classList.add('ea-offline');});
    if(!navigator.onLine)root.classList.add('ea-offline');
    setInterval(function(){updateSchedule();refreshNotices();},60000);
  }
  function renderProfile(){var name=profile.name.trim()||'Alumno de 1°D';var avatar=root.querySelector('#eaAvatar');root.querySelector('#eaProfileName').textContent=name;if(profile.avatar){avatar.textContent='';avatar.style.backgroundImage='url('+profile.avatar+')';avatar.classList.add('ea-avatar-photo');avatar.setAttribute('aria-label','Foto de perfil');}else{avatar.style.backgroundImage='';avatar.classList.remove('ea-avatar-photo');avatar.textContent=profile.name.trim()?profile.name.trim().slice(0,2).toUpperCase():'1D';avatar.removeAttribute('aria-label');}root.querySelector('#eaGreeting').textContent=profile.name.trim()?'Qué tal, '+profile.name.trim()+'. Aquí tienes tu día escolar.':'Tu centro personal para organizar el día escolar.';}
  var SUGGESTIONS_KEY = 'est60_app_suggestions_v1';
  var suggestions = read(SUGGESTIONS_KEY, []);
  function renderCredential(){
    if(!root)return;
    var name=profile.name.trim()||'Alumno de 1°D';
    root.querySelector('#eaIdName').textContent=name;
    root.querySelector('#eaIdCode').textContent='Código local: EST60-1D-'+(profile.cardCode||'--------');
    var avatar=root.querySelector('#eaIdAvatar');
    if(profile.avatar){avatar.textContent='';avatar.style.backgroundImage='url('+profile.avatar+')';avatar.classList.add('ea-avatar-photo');}
    else{avatar.style.backgroundImage='';avatar.classList.remove('ea-avatar-photo');avatar.textContent=profile.name.trim()?profile.name.trim().slice(0,2).toUpperCase():'1D';}
    var qr=root.querySelector('#eaProfileQr');
    var payload='EST60-1D-'+(profile.cardCode||'--------');
    qr.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data='+encodeURIComponent(payload);
    qr.onerror=function(){qr.style.display='none';};
    qr.onload=function(){qr.style.display='block';};
  }
  function copyIdCode(){
    var code='EST60-1D-'+(profile.cardCode||'--------');
    var done=function(){notify('Código copiado',code);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(code).then(done).catch(function(){notify('Código de perfil',code);});}
    else{notify('Código de perfil',code);}
  }
  function renderAchievements(){
    if(!root)return;
    var completed=personalTasks.filter(function(t){return t.done;}).length;
    var defs=[
      {id:'profile',icon:'PERFIL',title:'Perfil listo',desc:'Guardaste tus preferencias',ok:!!(profile.name.trim()||profile.avatar||profile.favorites.length)},
      {id:'photo',icon:'FOTO',title:'Buena imagen',desc:'Añadiste una foto de perfil',ok:!!profile.avatar},
      {id:'task1',icon:'1 TAREA',title:'Primer paso',desc:'Completaste una tarea personal',ok:completed>=1},
      {id:'task5',icon:'5 TAREAS',title:'Constancia',desc:'Completaste 5 tareas personales',ok:completed>=5},
      {id:'task10',icon:'10 TAREAS',title:'Imparable',desc:'Completaste 10 tareas personales',ok:completed>=10},
      {id:'ideas',icon:'IDEAS',title:'Con iniciativa',desc:'Guardaste una sugerencia',ok:suggestions.length>=1}
    ];
    var earned=defs.filter(function(d){return d.ok;}).length;
    root.querySelector('#eaAchievementCount').textContent=earned+'/'+defs.length;
    root.querySelector('#eaAchievements').innerHTML=defs.map(function(d){return '<div class="ea-achievement '+(d.ok?'is-earned':'')+'"><span class="ea-achievement-icon">'+(d.ok?'✓':d.icon)+'</span><span><strong>'+esc(d.title)+'</strong><small>'+esc(d.desc)+'</small></span><span class="ea-achievement-state">'+(d.ok?'DESBLOQUEADO':'BLOQUEADO')+'</span></div>';}).join('');
  }
  function updateSuggestionChars(){if(!root)return;var input=root.querySelector('#eaSuggestionText');root.querySelector('#eaSuggestionChars').textContent=String(input.value.length);}
  function saveSuggestion(event){
    event.preventDefault();
    var textValue=root.querySelector('#eaSuggestionText').value.trim();
    if(!textValue)return;
    if(textValue.length>500){notify('Texto demasiado largo','El máximo es de 500 caracteres.');return;}
    suggestions.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),category:root.querySelector('#eaSuggestionCategory').value,text:textValue,created:new Date().toLocaleDateString('es-MX')});
    suggestions=suggestions.slice(0,30);
    if(!write(SUGGESTIONS_KEY,suggestions)){suggestions.shift();notify('No se pudo guardar','Revisa el almacenamiento de tu dispositivo.');return;}
    event.target.reset();updateSuggestionChars();renderSuggestions();renderAchievements();
    notify('Sugerencia guardada','Quedó guardada en este dispositivo; todavía no se ha enviado.');
  }
  function renderSuggestions(){
    if(!root)return;
    var list=root.querySelector('#eaSuggestionList');
    if(!suggestions.length){list.innerHTML='<p class="ea-suggestion-empty">Aún no has guardado sugerencias.</p>';return;}
    list.innerHTML=suggestions.map(function(s){return '<article class="ea-suggestion-item"><div><span>'+esc(s.category)+' · '+esc(s.created)+'</span><p>'+esc(s.text)+'</p></div><button type="button" data-suggestion-delete="'+esc(s.id)+'" aria-label="Eliminar sugerencia">×</button></article>';}).join('');
  }
  function deleteSuggestion(event){
    var button=event.target.closest('[data-suggestion-delete]');
    if(!button)return;
    suggestions=suggestions.filter(function(s){return s.id!==button.getAttribute('data-suggestion-delete');});
    write(SUGGESTIONS_KEY,suggestions);renderSuggestions();renderAchievements();
  }
  function handleAvatarChange(event){var file=event.target.files&&event.target.files[0];if(!file)return;if(!/^image\//i.test(file.type)){notify('Archivo no válido','Selecciona una imagen JPG, PNG o WEBP.');event.target.value='';return;}if(file.size>12*1024*1024){notify('Imagen demasiado grande','Elige una imagen de menos de 12 MB.');event.target.value='';return;}var reader=new FileReader();reader.onload=function(){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas');var scale=Math.min(1,480/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);try{profile.avatar=canvas.toDataURL('image/jpeg',0.82);if(!write(KEY,profile)){profile.avatar='';notify('No se pudo guardar','El almacenamiento del dispositivo está lleno.');return;}renderProfile();renderCredential();renderAchievements();notify('Foto actualizada','Tu foto se guardó en este dispositivo.');}catch(_){profile.avatar='';notify('No se pudo guardar','Prueba con una imagen más pequeña.');}};img.onerror=function(){notify('No se pudo abrir','Prueba con otra imagen.');};img.src=String(reader.result||'');};reader.onerror=function(){notify('No se pudo leer','Vuelve a seleccionar la imagen.');};reader.readAsDataURL(file);}
  function applyTheme(){if(!root)return;root.classList.toggle('ea-light',profile.theme==='light');}
  function saveSettings(){profile.name=root.querySelector('#eaNameInput').value.trim();profile.theme=root.querySelector('#eaThemeSelect').value;profile.favorites=Array.from(root.querySelectorAll('#eaFavorites input:checked')).map(function(i){return i.value;});write(KEY,profile);renderProfile();renderCredential();renderAchievements();applyTheme();root.querySelector('#eaSaveMessage').textContent='Preferencias guardadas en este dispositivo.';notify('Preferencias guardadas','Tu apodo, tema y materias favoritas se guardaron en este celular.');}
  function notify(title,message){if(!root)return;var box=root.querySelector('#eaSaveMessage');if(box){box.textContent=title+': '+message;box.classList.add('ea-message-show');setTimeout(function(){box.classList.remove('ea-message-show');},4500);}}
  function renderTasks(){if(!root)return;var list=root.querySelector('#eaTaskList');var empty=root.querySelector('#eaTaskEmpty');empty.hidden=personalTasks.length>0;list.innerHTML=personalTasks.map(function(t){var late=t.date&&!t.done&&t.date<todayKey();var soon=t.date&&!t.done&&t.date>=todayKey()&&t.date<=new Date(Date.now()+86400000).toISOString().slice(0,10);return '<article class="ea-task '+(t.done?'is-done':'')+'"><label class="ea-task-check"><input type="checkbox" data-task-done="'+esc(t.id)+'" '+(t.done?'checked':'')+'><span class="ea-checkmark"></span></label><div class="ea-task-main"><strong>'+esc(t.title)+'</strong><div class="ea-task-meta">'+(t.subject?'<span>'+esc(t.subject)+'</span>':'<span>Personal</span>')+(t.date?'<span class="'+(late?'ea-late':soon?'ea-soon':'')+'">Entrega: '+esc(dateLabel(t.date))+(late?' · vencida':soon?' · próxima':'')+'</span>':'')+'</div></div><button type="button" data-task-delete="'+esc(t.id)+'" class="ea-delete" aria-label="Eliminar tarea">×</button></article>';}).join('');}
  function renderStats(){if(!root)return;var pending=personalTasks.filter(function(t){return !t.done;}).length;var count=root.querySelector('#eaTaskCount');var pend=root.querySelector('#eaPendingCount');if(count)count.textContent=personalTasks.length;if(pend)pend.textContent=pending;var alertCount=root.querySelector('#eaAlertCount');if(alertCount)alertCount.textContent=getAlerts().filter(function(a){return seenAlerts.indexOf(a.id)<0;}).length;}
  function updateSchedule(){if(!root)return;var cur=document.getElementById('smartCurrentSubject');var msg=document.getElementById('smartCurrentMessage');var next=document.getElementById('smartNextSubject');var nextTime=document.getElementById('smartNextTime');root.querySelector('#eaCurrentClass').textContent=cur?cur.textContent.trim():'Abre el horario para consultar';root.querySelector('#eaCurrentMessage').textContent=msg?msg.textContent.trim():'El horario inteligente está disponible más abajo.';root.querySelector('#eaNextClass').textContent=next?next.textContent.trim():'Consulta el horario completo';root.querySelector('#eaNextTime').textContent=nextTime?nextTime.textContent.trim():'Horario de 1°D';}
  function publicTaskItems(){var c=document.getElementById('tareasPublicas');if(!c)return [];return Array.from(c.querySelectorAll('.task-card')).map(function(el,i){return {id:'public-'+i,title:(el.querySelector('h3')||{}).textContent||'Tarea del grupo',detail:el.innerText||'',done:completedPublic.indexOf('public-'+i)>=0};}).filter(function(t){return t.title.indexOf('Cargando')<0&&t.title.indexOf('No se pudieron')<0&&t.title.indexOf('No hay tareas')<0;});}
  function renderPublicTasks(){if(!root)return;var existing=root.querySelector('#eaPublicTaskBlock');if(existing)existing.remove();var items=publicTaskItems();if(!items.length)return;var block=document.createElement('div');block.id='eaPublicTaskBlock';block.className='ea-public-tasks';block.innerHTML='<div class="ea-public-head"><strong>Tareas publicadas para el grupo</strong><span>Marca las que ya terminaste</span></div>'+items.map(function(t){return '<label class="ea-public-task"><input type="checkbox" data-public-done="'+esc(t.id)+'" '+(t.done?'checked':'')+'><span><strong>'+esc(t.title)+'</strong><small>'+esc(t.detail.replace(t.title,'').trim().slice(0,120))+'</small></span></label>';}).join('');root.querySelector('#eaTaskList').insertAdjacentElement('afterend',block);block.addEventListener('change',function(e){var id=e.target.getAttribute('data-public-done');if(!id)return;if(e.target.checked){if(completedPublic.indexOf(id)<0)completedPublic.push(id);}else{completedPublic=completedPublic.filter(function(x){return x!==id;});}write(DONE_KEY,completedPublic);renderPublicTasks();renderStats();});}
  function getAlerts(){var alerts=[];var n=document.getElementById('avisosPublicos');if(n){Array.from(n.querySelectorAll('.notice-card')).forEach(function(el,i){var title=(el.querySelector('h3')||{}).textContent||'';var body=(el.querySelector('p')||{}).textContent||'';if(title&&title.indexOf('Cargando')<0&&title.indexOf('No se pudieron')<0&&title.indexOf('No hay avisos')<0)alerts.push({id:'notice-'+title+'-'+body,title:title,body:body,type:'Aviso'});});}var ev=document.getElementById('eventosPublicos');if(ev){Array.from(ev.querySelectorAll('.calendar-card')).forEach(function(el){var title=(el.querySelector('strong')||{}).textContent||'';var body=(el.querySelector('p')||{}).textContent||'';if(title&&title.indexOf('Cargando')<0&&title.indexOf('Error al cargar')<0&&title.indexOf('No hay eventos')<0)alerts.push({id:'event-'+title,title:title,body:body,type:'Evento'});});}personalTasks.filter(function(t){return !t.done&&t.date;}).forEach(function(t){alerts.push({id:'task-'+t.id,title:t.title,body:'Entrega: '+dateLabel(t.date),type:t.date<todayKey()?'Tarea vencida':'Recordatorio de tarea'});});return alerts;}
  function refreshNotices(){if(!root)return;var items=getAlerts();var list=root.querySelector('#eaNoticeList');if(!items.length){list.innerHTML='<div class="ea-notice-empty">No hay avisos nuevos por mostrar. Cuando se publiquen novedades, aparecerán aquí.</div>';renderStats();return;}list.innerHTML=items.slice(0,8).map(function(a){var fresh=seenAlerts.indexOf(a.id)<0;return '<article class="ea-notice-item '+(fresh?'is-new':'')+'"><span class="ea-notice-icon">'+(a.type==='Evento'?'CAL':a.type.indexOf('Tarea')>=0?'TAR':'AVS')+'</span><div class="ea-notice-copy"><span class="ea-notice-type">'+esc(a.type)+(fresh?' · NUEVO':' · LEÍDO')+'</span><strong>'+esc(a.title)+'</strong><p>'+esc(a.body).slice(0,180)+'</p>'+(fresh?'<button type="button" class="ea-mark-read" data-alert-read="'+esc(a.id)+'">Marcar como leído</button>':'<span class="ea-read-label">Leído</span>')+'</div></article>';}).join('');renderStats();renderPublicTasks();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createPanel);else createPanel();
})();