import React from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

interface LinkToastAlertProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export const LinkToastAlert: React.FC<LinkToastAlertProps> = ({ open, message, onClose }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={onClose}
        severity="success"
        variant="filled"
        icon={<RocketLaunchIcon fontSize="inherit" />}
        sx={{
          backgroundColor: 'rgba(11, 19, 32, 0.95)',
          color: '#00ff88',
          border: '1px solid #00ff88',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 25px rgba(0, 255, 136, 0.4)',
          '& .MuiAlert-icon': {
            color: '#00ff88',
          },
        }}
      >
        <AlertTitle sx={{ fontFamily: 'Orbitron', fontWeight: 700, fontSize: '0.85rem' }}>
          LORA RF LINK ESTABLISHED
        </AlertTitle>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#f1f5f9' }}>
          {message || 'HELLO Handshake Received from CubeSat-1!'}
        </span>
      </Alert>
    </Snackbar>
  );
};
