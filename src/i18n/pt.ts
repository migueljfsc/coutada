import type { Dictionary } from "./core";

export const pt: Dictionary = {
  // ------------------------------------------------------------------- app
  "app.name": "Coutada",
  "app.locale": "Idioma",
  "locale.pt": "Português",
  "locale.en": "English",

  // ------------------------------------------------------------------- map
  "map.untitled": "Mapa sem nome",
  "sheet.label": "Detalhes do mapa",
  "sheet.expand": "Mostrar detalhes",
  "sheet.collapse": "Esconder detalhes",

  // --------------------------------------------------------------- imagery
  "imagery.title": "Imagem",
  "imagery.ortosat2023": "Satélite, 2023",
  "imagery.ortosat2023.detail": "30 cm, todo o continente",
  "imagery.ortos2021": "Fotografia aérea, 2021",
  "imagery.ortos2021.detail": "25 cm, a norte do Tejo, por vezes lenta",
  "imagery.esri": "Esri World Imagery",
  "imagery.esri.detail": "Mundial, só com rede",
  "imagery.failing": "{source} não está a responder. O mapa mostra o que já carregou.",
  "imagery.useDefault": "Usar o satélite",

  // ------------------------------------------------------------ my position
  "locate.start": "Mostrar a minha posição",
  "locate.recenter": "Centrar na minha posição",
  "locate.stop": "Deixar de mostrar a minha posição",
  "locate.off": "A sua posição não está visível.",
  "locate.asking": "A procurar a sua posição…",
  "locate.accuracy": "Está aqui, com uma margem de {m} m.",
  "locate.denied": "A localização está bloqueada para este site. Permita-a nas definições do navegador para se ver no mapa.",
  "locate.unavailable": "Ainda sem sinal de GPS. Vá para céu aberto e tente de novo.",
  "position.coords": "Coordenadas",
  "position.accuracy": "Margem",

  // -------------------------------------------------------------- documents
  "doc.notAMap": "Este ficheiro não é um mapa do Coutada.",
  "doc.tooNew": "Este mapa foi guardado por uma versão mais recente do Coutada (v{version}). Recarregue a página para atualizar.",
  "doc.invalid": "Este mapa está danificado ou é demasiado grande para abrir.",

  // ----------------------------------------------------------------- safety
  "safety.notice": "Não é um sistema de segurança. Confirme sempre à vista e por rádio.",
};
