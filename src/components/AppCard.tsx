import React, { ReactNode } from 'react';
import { Box, Paper, Stack, SxProps, Theme, Typography } from '@mui/material';

type AppCardProps = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
};

const AppCard: React.FC<AppCardProps> = ({ title, actions, children, sx, contentSx }) => {
  return (
    <Paper
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: (theme) => `0 1px 2px ${theme.palette.divider}`,
        p: 2.5,
        ...sx,
      }}
    >
      {title || actions ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
          {title ? (
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
          ) : (
            <span />
          )}
          {actions ? <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>{actions}</Box> : null}
        </Stack>
      ) : null}
      <Box sx={{ mt: title || actions ? 2 : 0, ...contentSx }}>{children}</Box>
    </Paper>
  );
};

export default AppCard;

