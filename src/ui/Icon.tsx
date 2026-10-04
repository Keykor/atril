const PATHS = {
  book: 'M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  sliders:
    'M4 7h9M17 7h3M4 17h3M11 17h9M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  plus: 'M12 5v14M5 12h14',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 1 0-14 0M21 21l-4.3-4.3',
  down: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  upload: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  download: 'M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  back: 'M19 12H5M12 19l-7-7 7-7',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  highlighter: 'M9 11l4 4M5 19l2-6 8-8 4 4-8 8-6 2zM3 21h6',
  eraser: 'M7 21h13M5 17l9-13 7 5-9 12H8z',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  metronome: 'M7 21L10 3h4l3 18zM12 16l5-8M8 17h8',
  keyboard:
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 4v16M16 4v16M12 13v7',
  note: 'M9 18V5l12-2v13M3 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0M15 16a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  close: 'M6 6l12 12M18 6L6 18',
  cloud: 'M17.5 19H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  play: 'M7 4l13 8-13 8z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  check: 'M5 12l5 5 9-10',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
