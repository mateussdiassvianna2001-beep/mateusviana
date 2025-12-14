// --- Inicializa mapa ---
let map = L.map('map').setView([-10.7,-48.35],8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19 }).addTo(map);

let markers = {saida:null, chegada:null};
let rotaCidades = [];
let campoAtivo = null;

// Ativar campo
function ativarCampo(input, tipo){
  if(campoAtivo) campoAtivo.classList.remove('active');
  campoAtivo = input;
  campoAtivo.classList.add('active');
  campoAtivo.dataset.tipo = tipo;
}
document.getElementById('saida').addEventListener('click', ()=> ativarCampo(document.getElementById('saida'),'saida'));
document.getElementById('chegada').addEventListener('click', ()=> ativarCampo(document.getElementById('chegada'),'chegada'));

// Clique no mapa
map.on('click', function(e){
  if(!campoAtivo) return;
  const tipo = campoAtivo.dataset.tipo;

  if(markers[tipo]) map.removeLayer(markers[tipo]);
  const marker = L.marker(e.latlng).addTo(map);
  markers[tipo] = marker;

  campoAtivo.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  rotaCidades[tipo==='saida'?0:1] = e.latlng;

  campoAtivo.classList.remove('active');
  campoAtivo = null;
});

// Limpar campos
document.getElementById('clearSaida').addEventListener('click', ()=>{
  if(markers.saida) map.removeLayer(markers.saida);
  markers.saida = null;
  document.getElementById('saida').value='';
  rotaCidades[0]=null;
});
document.getElementById('clearChegada').addEventListener('click', ()=>{
  if(markers.chegada) map.removeLayer(markers.chegada);
  markers.chegada = null;
  document.getElementById('chegada').value='';
  rotaCidades[1]=null;
});

// --- Preço por KM ---
const precoInput = document.getElementById('precoKm');
const btnCalcular = document.getElementById('calcular');
function atualizarBotao(){
  btnCalcular.disabled = !(precoInput.value && parseFloat(precoInput.value)>0);
}
precoInput.addEventListener('input', atualizarBotao);
precoInput.addEventListener('blur', ()=>{
  if(precoInput.value){
    precoInput.value = parseFloat(precoInput.value).toFixed(2);
    atualizarBotao();
  }
});

// --- Custos extras dinâmicos ---
const custosContainer = document.getElementById('custosContainer');
document.getElementById('addCusto').addEventListener('click', ()=>{
  const div = document.createElement('div');
  div.classList.add('custo-input');
  div.innerHTML = `
    <input type="text" class="nome-custo" placeholder="Nome do custo">
    <input type="number" class="valor-custo" placeholder="" step="0.01">
    <button class="remover-custo">×</button>
  `;
  custosContainer.appendChild(div);

  div.querySelector('.remover-custo').addEventListener('click', ()=> div.remove());
  div.querySelector('.valor-custo').addEventListener('blur', ()=>{
    if(div.querySelector('.valor-custo').value)
      div.querySelector('.valor-custo').value = parseFloat(div.querySelector('.valor-custo').value).toFixed(2);
  });
});

// Atualizar valores ao clicar fora
document.addEventListener('click', ()=>{
  document.querySelectorAll('.valor-custo').forEach(input=>{
    if(input.value) input.value = parseFloat(input.value).toFixed(2);
  });
});

// --- Calcular distância OSRM ---
async function calcularDistanciaOSRM(){
  if(!rotaCidades[0] || !rotaCidades[1]){ alert('Selecione saída e chegada no mapa!'); return 0; }
  const coords = `${rotaCidades[0].lng},${rotaCidades[0].lat};${rotaCidades[1].lng},${rotaCidades[1].lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
  try{
    const res = await fetch(url); 
    const data = await res.json();
    if(data.routes && data.routes.length>0) return data.routes[0].distance/1000;
    else { alert('Não foi possível calcular a rota.'); return 0; }
  }catch(err){ alert('Erro ao calcular rota:'+err); return 0; }
}

// --- Loading overlay ---
const loadingOverlay = document.getElementById('loadingOverlay');

// --- Calcular frete ---
btnCalcular.addEventListener('click', async ()=>{
  if(!precoInput.value || parseFloat(precoInput.value)<=0){ alert('Informe o preço por KM!'); return; }

  const precoKm = parseFloat(precoInput.value)||3.00;
  const arredondamento = document.getElementById('arredondamento').value;

  // Somar todos os custos
  let custoTotal = 0;
  let todosPreenchidos = true;
  let listaCustosHtml = '';
  document.querySelectorAll('.custo-input').forEach(input=>{
    const nome = input.querySelector('.nome-custo').value || 'Custo';
    const valorInput = input.querySelector('.valor-custo').value;
    if(!valorInput || parseFloat(valorInput)<0) todosPreenchidos=false;
    else {
      const valor = parseFloat(valorInput);
      custoTotal += valor;
      listaCustosHtml += `<li>${nome}: R$ ${valor.toFixed(2)}</li>`;
    }
  });
  if(!todosPreenchidos){ alert('Preencha todos os valores de custo!'); return; }

  // MOSTRAR overlay de loading
  loadingOverlay.style.display='flex';
  btnCalcular.disabled=true;

  // Calcular distância e tempo
  const coords = `${rotaCidades[0].lng},${rotaCidades[0].lat};${rotaCidades[1].lng},${rotaCidades[1].lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
  let distancia = 0, duracao = 0;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if(data.routes && data.routes.length>0){
      distancia = data.routes[0].distance / 1000; // km
      duracao = data.routes[0].duration; // segundos
    } else {
      alert('Não foi possível calcular a rota.');
      loadingOverlay.style.display='none';
      btnCalcular.disabled=false;
      return;
    }
  } catch(err){
    alert('Erro ao calcular rota:'+err);
    loadingOverlay.style.display='none';
    btnCalcular.disabled=false;
    return;
  }

  loadingOverlay.style.display='none';
  btnCalcular.disabled=false;

  // Calcular frete
  let frete = (distancia*precoKm) + custoTotal;
  if(arredondamento==='up') frete=Math.ceil(frete);
  else if(arredondamento==='down') frete=Math.floor(frete);
  else frete=Math.round(frete*100)/100;

  // Converter duração em horas:minutos
  const horas = Math.floor(duracao/3600);
  const minutos = Math.round((duracao%3600)/60);
  const duracaoFormatada = `${horas}h ${minutos}min`;

  const resultado = document.getElementById('resultado');
  resultado.style.display='block';
  resultado.innerHTML = `
    <p><strong>Frete Total:</strong> R$ ${frete.toFixed(2)}</p>
    <p><strong>Distância estimada:</strong> ${distancia.toFixed(2)} KM</p>
    <p><strong>Tempo estimado:</strong> ${duracaoFormatada}</p>
    <ul>
      <li>Preço por KM: R$ ${precoKm.toFixed(2)}</li>
      ${listaCustosHtml}
    </ul>
  `;

  // Scroll automático para o resultado
  resultado.scrollIntoView({behavior:"smooth"});
});

