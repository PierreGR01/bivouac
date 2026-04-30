import { PoiLocation } from './types';

export const mockLocations: PoiLocation[] = [
  {
    id: '1',
    position: { lat: 45.8326, lng: 6.8652 },
    title: 'Lac Blanc - Mont-Blanc',
    description: 'Magnifique spot au pied des Aiguilles Rouges avec une vue imprenable sur le massif du Mont-Blanc. Terrain plat propice au bivouac.',
    photos: [
      'https://images.unsplash.com/photo-1657038455340-d95a1cc49db8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGNhbXBpbmclMjB0ZW50JTIwc3VucmlzZXxlbnwxfHx8fDE3NzAyOTQ4NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1544731059-8485db0c69e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbHBpbmUlMjBsYWtlJTIwY2FtcGluZ3xlbnwxfHx8fDE3NzAyOTQ4NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    season: 'été',
    waterProximity: 'proche',
    regulations: 'Bivouac autorisé de 19h à 9h. Parc National - Respecter la réglementation.'
  },
  {
    id: '2',
    position: { lat: 44.9194, lng: 6.6275 },
    title: 'Plateau d\'Emparis',
    description: 'Vaste plateau d\'altitude offrant de nombreux emplacements pour bivouaquer. Vue panoramique sur la Meije et les Écrins.',
    photos: [
      'https://images.unsplash.com/photo-1641384181341-a6fc82505886?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2YWxsZXklMjBjYW1waW5nJTIwc3BvdHxlbnwxfHx8fDE3NzAyOTQ4Nzh8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1590256446678-51a8e0a3c70b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aWxkZXJuZXNzJTIwY2FtcGluZyUyMHN1bnNldHxlbnwxfHx8fDE3NzAyOTQ4Nzd8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    season: 'été',
    waterProximity: 'éloigné',
    regulations: 'Bivouac toléré. Zone Natura 2000 - Éviter les zones marécageuses.'
  },
  {
    id: '3',
    position: { lat: 46.5397, lng: 6.6608 },
    title: 'Forêt du Jura - Crêt de Chalam',
    description: 'Emplacement forestier discret avec des clairières idéales. Accessible toute l\'année avec équipement adapté.',
    photos: [
      'https://images.unsplash.com/photo-1654162458254-0ba769279235?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3Jlc3QlMjBiaXZvdWFjJTIwY2FtcHxlbnwxfHx8fDE3NzAyOTQ4NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    season: 'hiver',
    waterProximity: null,
    regulations: 'Bivouac autorisé en dehors des réserves naturelles. Feu interdit.'
  },
  {
    id: '4',
    position: { lat: 43.0529, lng: 0.1408 },
    title: 'Cirque de Gavarnie - Pyrénées',
    description: 'Site exceptionnel au pied des cascades. Altitude élevée, réservé aux bivouaqueurs expérimentés.',
    photos: [
      'https://images.unsplash.com/photo-1697051270570-4495123929ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMHN0cmVhbSUyMHdhdGVyfGVufDF8fHx8MTc3MDI5NDg3N3ww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    season: 'été',
    waterProximity: 'proche',
    regulations: 'Parc National des Pyrénées - Bivouac réglementé de 19h à 9h uniquement.'
  },
  {
    id: '5',
    position: { lat: 44.1362, lng: 7.6872 },
    title: 'Vallée des Merveilles',
    description: 'Site archéologique remarquable avec gravures rupestres. Bivouac strictement encadré pour protéger le patrimoine.',
    photos: [
      'https://images.unsplash.com/photo-1590256446678-51a8e0a3c70b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aWxkZXJuZXNzJTIwY2FtcGluZyUyMHN1bnNldHxlbnwxfHx8fDE3NzAyOTQ4Nzd8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1657038455340-d95a1cc49db8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGNhbXBpbmclMjB0ZW50JTIwc3VucmlzZXxlbnwxfHx8fDE3NzAyOTQ4NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    season: 'été',
    waterProximity: 'proche',
    regulations: 'Zone de protection stricte - Bivouac interdit dans certains secteurs. Consulter les gardes du parc.'
  }
];
