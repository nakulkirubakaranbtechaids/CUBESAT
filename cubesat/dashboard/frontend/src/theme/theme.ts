import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#060b13',
      paper: 'rgba(11, 19, 32, 0.95)',
    },
    primary: {
      main: '#00f0ff', // Cyber cyan
      light: '#66f5ff',
      dark: '#00a0b2',
      contrastText: '#000000',
    },
    secondary: {
      main: '#00ff88', // Cyber lime green
      light: '#66ffb2',
      dark: '#00b359',
      contrastText: '#000000',
    },
    error: {
      main: '#ff3366', // Crimson
      light: '#ff6688',
      dark: '#cc0033',
    },
    warning: {
      main: '#ffb700', // Amber
      light: '#ffcc44',
      dark: '#c48900',
    },
    info: {
      main: '#00f0ff',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
    divider: 'rgba(0, 240, 255, 0.12)',
  },
  typography: {
    fontFamily: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'].join(','),
    h1: {
      fontFamily: ['Orbitron', 'sans-serif'].join(','),
      fontWeight: 700,
      letterSpacing: '0.08em',
    },
    h2: {
      fontFamily: ['Orbitron', 'sans-serif'].join(','),
      fontWeight: 700,
      fontSize: '0.95rem',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
    h3: {
      fontFamily: ['Orbitron', 'sans-serif'].join(','),
      fontWeight: 600,
    },
    subtitle1: {
      fontFamily: ['JetBrains Mono', 'monospace'].join(','),
      fontSize: '0.75rem',
      letterSpacing: '0.05em',
    },
    subtitle2: {
      fontFamily: ['JetBrains Mono', 'monospace'].join(','),
      fontSize: '0.7rem',
      color: '#64748b',
    },
    body1: {
      fontSize: '0.85rem',
    },
    body2: {
      fontSize: '0.78rem',
      fontFamily: ['JetBrains Mono', 'monospace'].join(','),
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#060b13',
          color: '#f1f5f9',
          fontFamily: 'Inter, sans-serif',
          scrollbarColor: '#00f0ff #0b1320',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#060b13',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#1e293b',
            borderRadius: '3px',
            '&:hover': {
              background: '#00f0ff',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11, 19, 32, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 240, 255, 0.15)',
          borderRadius: 8,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          transition: 'all 0.25s ease-in-out',
          '&:hover': {
            borderColor: 'rgba(0, 240, 255, 0.35)',
            boxShadow: '0 8px 32px 0 rgba(0, 240, 255, 0.12)',
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '10px 14px',
          borderBottom: '1px solid rgba(0, 240, 255, 0.12)',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        },
        title: {
          fontSize: '0.85rem',
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 700,
          color: '#e2e8f0',
          letterSpacing: '0.04em',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '12px 14px',
          '&:last-child': {
            paddingBottom: '12px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: 'JetBrains Mono, monospace',
          textTransform: 'uppercase',
          fontWeight: 600,
          borderRadius: 4,
          fontSize: '0.72rem',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
          fontSize: '0.7rem',
          borderRadius: 4,
        },
      },
    },
  },
});
