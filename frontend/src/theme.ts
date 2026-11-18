import { alpha, createTheme } from '@mui/material/styles';

/** The warm, editorial look shared with my earlier projects (Expense Manager, Sewadaar Directory). */
export const palette = {
  brown: '#8b5a2b',
  brownDark: '#6e4520',
  green: '#3f5f4a',
  cream: '#f7f1e8',
  paper: '#fffdf8',
  ink: '#2a2118',
  muted: '#6f6457',
  line: '#e6dccd',
};

const serif = 'Georgia, "Times New Roman", "Libre Baskerville", serif';

export const theme = createTheme({
  palette: {
    primary: { main: palette.brown, dark: palette.brownDark, contrastText: '#fff' },
    secondary: { main: palette.green, contrastText: '#fff' },
    background: { default: palette.cream, paper: palette.paper },
    text: { primary: palette.ink, secondary: palette.muted },
    divider: palette.line,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: serif,
    h1: { fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.45rem', fontWeight: 700 },
    h3: { fontSize: '1.15rem', fontWeight: 700 },
    overline: { letterSpacing: '0.08em', fontSize: '0.75rem' },
    button: { letterSpacing: '0.04em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.cream,
          backgroundImage: `radial-gradient(circle at 70% 0%, ${alpha('#ffffff', 0.7)}, transparent 55%)`,
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 28,
          border: `1px solid ${palette.line}`,
          boxShadow: '0 6px 18px rgba(80, 55, 25, 0.08)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 18 },
        outlined: { borderColor: alpha(palette.brown, 0.4) },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 999 } } },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 14, backgroundColor: palette.paper } },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24 } } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: palette.muted,
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.06em',
        },
      },
    },
  },
});
