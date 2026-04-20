import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import {
  Box, Typography, Button, Container, Grid, Paper, Divider,
} from '@mui/material';
import {
  Upload, Share2, Inbox, FolderOpen, Link, FileText, Shield, Zap, Eye,
  Github, ArrowRight,
} from 'lucide-react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { motion } from 'motion/react';

const features = [
  {
    icon: <Upload size={22} />,
    title: 'File Storage',
    desc: 'Upload and organize files in a structured folder tree. Your own private bucket, accessible anytime.',
  },
  {
    icon: <Share2 size={22} />,
    title: 'Targeted Sharing',
    desc: "Share files directly with registered users. Set expiry times and track what you've sent.",
  },
  {
    icon: <Link size={22} />,
    title: 'Quick Share Links',
    desc: 'Generate one-time download links for any file instantly — no account required on the recipient side.',
  },
  {
    icon: <Inbox size={22} />,
    title: 'Received Files',
    desc: 'Files shared with you appear in your inbox. Preview inline or download — always organised.',
  },
  {
    icon: <FolderOpen size={22} />,
    title: 'Folder Management',
    desc: 'Create folders, move files around, and keep things tidy with a full tree-based file manager.',
  },
  {
    icon: <FileText size={22} />,
    title: 'Inline Notes',
    desc: 'Attach a personal note to any file. Keep context close to your content.',
  },
  {
    icon: <Eye size={22} />,
    title: 'File Preview',
    desc: 'Preview images, PDFs, and text files directly in the browser — no download needed.',
  },
  {
    icon: <Shield size={22} />,
    title: 'Private by Default',
    desc: 'Every file is private until you explicitly share it. Signed tokens protect every download.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Self-Hostable',
    desc: 'Deploy FluxSend on your own infrastructure. Full control over your data and storage backend.',
  },
];

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const dark = mode === 'dark';

  const scrollToSection = (id: 'home' | 'features' | 'start') => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Redirect authenticated users straight to the app
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/files', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) return null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        scrollBehavior: 'smooth',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        '& *::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        '& *': {
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
        backgroundColor: dark ? '#0d1117' : '#f6f8fa',
        color: dark ? '#e6edf3' : '#1f2328',
      }}
    >
      {/* ── Nav ── */}
      <Box
        component="nav"
        sx={{
          borderBottom: `1px solid ${dark ? '#30363d' : '#d0d7de'}`,
          px: { xs: 3, md: 6 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: dark ? '#0d1117' : '#f6f8fa',
        }}
      >
        <div className="flex items-center align-left gap-2">
        <img src="/fs.png" alt="FluxSend logo" className="h-6 sm:h-8 w-auto opacity-90" />
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{ letterSpacing: '-0.02em', color: dark ? '#e6edf3' : '#1f2328' }}
        >
          FLUX<span style={{ color: '#6366f1' }}>SEND</span>
        </Typography>
        </div>

        <div className="flex items-center align-left gap-2">
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="text"
            size="small"
            onClick={() => scrollToSection('home')}
            sx={{ color: dark ? '#7d8590' : '#57606a', display: { xs: 'none', md: 'inline-flex' } }}
          >
            Home
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => scrollToSection('features')}
            sx={{ color: dark ? '#7d8590' : '#57606a', display: { xs: 'none', md: 'inline-flex' } }}
          >
            Features
          </Button>
          <Button
            variant="text"
            size="small"
            href="https://github.com/tscrond/fluxsend-backend"
            target="_blank"
            startIcon={<Github size={15} />}
            sx={{ color: dark ? '#7d8590' : '#57606a' }}
          >
            GitHub
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/login')}
            sx={{ fontWeight: 700 }}
          >
            Sign in
          </Button>
        </Box>
        </div>


      </Box>

      {/* ── Hero ── */}
      <Box
        id="home"
        component="section"
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
      <motion.div
        initial={{ opacity: 0, y: 26, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        style={{ width: '100%' }}
      >
        <Container maxWidth="md" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 10 }, textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
            <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: { xs: 1.5, md: 2 },
            py: { xs: 0.5, md: 0.75 },
            mb: 4,
            borderRadius: 5,
            border: `1px solid ${dark ? '#30363d' : '#d0d7de'}`,
            backgroundColor: dark ? '#161b22' : '#ffffff',
          }}
            >
              <Box sx={{ width: { xs: 6, md: 8 }, height: { xs: 6, md: 8 }, borderRadius: '50%', backgroundColor: '#3fb950' }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: dark ? '#7d8590' : '#57606a', fontSize: { xs: '0.6rem', md: '0.72rem' } }}>
                  self-hostable · open source · developer-friendly
                </Typography>
              </Box>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}>
            <Typography
              variant="h2"
              fontWeight={800}
              sx={{
                fontSize: { xs: '2.2rem', md: '3.25rem' },
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                mb: 3,
              }}
            >
              Secure file sharing,{' '}
              <Box component="span" sx={{ color: '#6366f1' }}>
                made simple.
              </Box>
            </Typography>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }}>
            <Typography
              variant="h6"
              color="text.secondary"
              fontWeight={400}
              sx={{ maxWidth: 520, mx: 'auto', mb: 5, lineHeight: 1.6, fontSize: '1.1rem' }}
            >
              Upload, store, and share your files with anyone.
              Fast, secure, and effortless — hosted on your own infrastructure.
            </Typography>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/login')}
                endIcon={<ArrowRight size={18} />}
                sx={{
                  backgroundColor: '#6366f1',
                  '&:hover': { backgroundColor: '#4f46e5' },
                  px: 3.5,
                  py: 1.25,
                  fontSize: '0.95rem',
                  transition: 'transform 0.2s ease',
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                Get Started
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => scrollToSection('features')}
                sx={{ px: 3.5, py: 1.25, fontSize: '0.95rem' }}
              >
                See Features
              </Button>
            </Box>
          </motion.div>
        </Container>
      </motion.div>
      </Box>

      {/* ── Mockup preview ── */}
      {/* <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.55 }}
      >
        <Container maxWidth="md" sx={{ pb: { xs: 8, md: 12 } }}>
        <Box
          component={motion.div}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <MockupBlock dark={dark} />
        </Box>
        </Container>
      </motion.div> */}

      <Divider sx={{ borderColor: dark ? '#30363d' : '#d0d7de' }} />

      {/* ── Features ── */}
      <Box
        id="features"
        component="section"
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <motion.div
          initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="overline"
            sx={{ color: '#6366f1', letterSpacing: '0.12em', fontSize: '0.75rem', fontWeight: 700 }}
          >
            Features
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 1, letterSpacing: '-0.02em' }}>
            Everything you need to share files
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, maxWidth: 480, mx: 'auto', lineHeight: 1.7 }}>
            Built for developers and power users who want full control without sacrificing usability.
          </Typography>
          </Box>
        </motion.div>

        <Grid container spacing={2.5}>
          {features.map((f, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f.title}>
              <motion.div
                initial={{ opacity: 0, y: 22, filter: 'blur(3px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    height: '100%',
                    borderColor: dark ? '#30363d' : '#d0d7de',
                    backgroundColor: dark ? '#161b22' : '#ffffff',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': {
                      borderColor: '#6366f1',
                      transform: 'translateY(-3px)',
                    },
                  }}
                >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6366f1',
                    mb: 2,
                  }}
                >
                  {f.icon}
                </Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                  {f.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                  {f.desc}
                </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
      </Box>

      <Divider sx={{ borderColor: dark ? '#30363d' : '#d0d7de' }} />

      {/* ── CTA banner ── */}
      <Box
        id="start"
        component="section"
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
      <motion.div
        initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.62, ease: 'easeOut' }}
        style={{ width: '100%' }}
      >
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 2, letterSpacing: '-0.02em' }}>
          Ready to take control of your files?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 440, mx: 'auto', lineHeight: 1.7 }}>
          Sign in to your FluxSend instance and start sharing securely.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/login')}
          endIcon={<ArrowRight size={18} />}
          sx={{
            backgroundColor: '#6366f1',
            '&:hover': { backgroundColor: '#4f46e5' },
            px: 4,
            py: 1.25,
            fontSize: '0.95rem',
            transition: 'transform 0.2s ease',
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          Get Started
        </Button>
        </Container>
      </motion.div>
      </Box>

      <Divider sx={{ borderColor: dark ? '#30363d' : '#d0d7de' }} />

      {/* ── Footer ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.4 }}
      >
        <Box
          component="footer"
          sx={{
            px: { xs: 3, md: 6 },
            py: 4,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.disabled" fontWeight='bolder'>
            FLUX<span style={{ color: '#6366f1' }}>SEND</span>
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Self-hosted · Secure · Open source
          </Typography>
          <Button
            variant="text"
            size="small"
            href="https://github.com/tscrond/fluxsend-backend"
            target="_blank"
            startIcon={<Github size={14} />}
            sx={{ color: dark ? '#7d8590' : '#57606a', minWidth: 0 }}
          >
            GitHub
          </Button>
        </Box>
      </motion.footer>
    </Box>
  );
}
