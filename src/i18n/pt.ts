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

  // ----------------------------------------------------------------- types
  "type.porta": "Porta",
  "type.landmark": "Ponto de referência",
  "type.gate": "Cancela",
  "type.parking": "Estacionamento",
  "type.meeting": "Ponto de encontro",
  "type.danger": "Perigo",
  "type.water": "Água para os cães",
  "type.walk": "Percurso",
  "type.armada": "Armada",
  "type.mancha": "Mancha",
  "type.no_shoot": "Zona proibida",
  "type.boundary": "Limite da propriedade",
  "colour.white": "Branco",
  "colour.yellow": "Amarelo",
  "colour.cyan": "Ciano",
  "colour.magenta": "Magenta",
  "colour.lime": "Verde-lima",
  "colour.red": "Vermelho",

  // --------------------------------------------------------------- drawing
  "tool.pin": "Marcar um local",
  "tool.line": "Desenhar um percurso",
  "tool.area": "Desenhar uma área",
  "pick.pin": "O que vai marcar?",
  "pick.line": "Que tipo de linha?",
  "pick.area": "Que tipo de área?",
  "draw.tapPin": "Toque no mapa onde fica.",
  "draw.tapLine": "Toque no mapa para acrescentar pontos e depois conclua.",
  "draw.points.one": "1 ponto",
  "draw.points.other": "{count} pontos",
  "draw.undoPoint": "Anular ponto",
  "draw.cancel": "Cancelar",
  "draw.finish": "Concluir",
  "history.undo": "Desfazer",
  "history.redo": "Refazer",

  // ---------------------------------------------------------------- editing
  "edit.close": "Fechar",
  "edit.name": "Nome",
  "edit.nameInvalid": "Use só letras, números e pontuação, até 60 caracteres.",
  "edit.colour": "Cor",
  "edit.note": "Nota",
  "edit.number": "Número",
  "edit.armada": "Armada",
  "edit.noArmada": "Fora de armada",
  "edit.numberPortas.one": "Numerar a porta",
  "edit.numberPortas.other": "Numerar as {count} portas",
  "edit.noPortas": "Ainda não há portas nesta armada. As portas marcadas a menos de 40 m juntam-se a ela.",
  "edit.length": "Comprimento",
  "edit.area": "Área",
  "edit.shapeHint": "Arraste um ponto para o mudar de sítio; arraste um ponto pequeno para acrescentar outro.",
  "edit.pinHint": "Arraste para mudar de sítio.",
  "edit.deleteVertex": "Apagar este ponto",
  "edit.delete": "Apagar",
  "map.name": "Nome do mapa",
  "list.empty": "Ainda não há nada desenhado. Use as ferramentas à direita para marcar portas, percursos e áreas.",
  "list.portaN": "Porta {n}",

  // -------------------------------------------------------------- documents
  "doc.notAMap": "Este ficheiro não é um mapa do Coutada.",
  "doc.tooNew": "Este mapa foi guardado por uma versão mais recente do Coutada (v{version}). Recarregue a página para atualizar.",
  "doc.invalid": "Este mapa está danificado ou é demasiado grande para abrir.",

  // ----------------------------------------------------------------- safety
  "safety.notice": "Não é um sistema de segurança. Confirme sempre à vista e por rádio.",
};
