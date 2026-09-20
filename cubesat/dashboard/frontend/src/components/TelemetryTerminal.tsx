import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Button,
  Paper,
} from '@mui/material';

import TerminalIcon from '@mui/icons-material/Terminal';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import type { LogEntry } from '../types/telemetry';
import { downloadTelemetryCsv } from '../services/api';

interface TelemetryTerminalProps {
  logs: LogEntry[];
  onClear: () => void;
}

export const TelemetryTerminal: React.FC<TelemetryTerminalProps> = ({ logs, onClear }) => {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownloadCsv = async () => {
    try {
      setDownloading(true);
      await downloadTelemetryCsv();
    } catch (err) {
      console.error('Failed to download CSV log:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        avatar={<TerminalIcon sx={{ color: '#00f0ff' }} />}
        title="LORA RF TELEMETRY STREAM & LOG"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCsv}
              disabled={downloading}
              sx={{ fontSize: '0.65rem', py: 0.3 }}
            >
              {downloading ? 'DOWNLOADING...' : 'DOWNLOAD CSV'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<DeleteIcon />}
              onClick={onClear}
              sx={{ fontSize: '0.65rem', py: 0.3 }}
            >
              CLEAR LOG
            </Button>
          </Box>
        }
      />

      <CardContent sx={{ flexGrow: 1, p: 0, '&:last-child': { pb: 0 } }}>
        <Paper
          sx={{
            height: 180,
            overflowY: 'auto',
            backgroundColor: '#030712',
            p: 1.5,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.72rem',
            lineHeight: 1.6,
            borderRadius: 0,
            borderTop: '1px solid rgba(0, 240, 255, 0.1)',
          }}
        >
          {logs.map((log) => {
            let textColor = '#94a3b8';
            if (log.type === 'telemetry') textColor = '#00f0ff';
            else if (log.type === 'alert') textColor = '#00ff88';
            else if (log.type === 'warning') textColor = '#ffb700';

            return (
              <Box key={log.id} sx={{ mb: 0.3, display: 'flex', gap: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.68rem',
                    color: '#475569',
                    userSelect: 'none',
                  }}
                >
                  [{log.timestamp}]
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.72rem',
                    color: textColor,
                    wordBreak: 'break-all',
                  }}
                >
                  {log.text}
                </Typography>
              </Box>
            );
          })}
        </Paper>

      </CardContent>
    </Card>
  );
};
