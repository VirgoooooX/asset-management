import React, { ReactNode } from 'react';
import { Box, Container, ContainerProps, Stack, Typography } from '@mui/material';
import { APP_PAGE_FRAME } from '../theme'

type PageShellProps = {
  title: ReactNode;
  actions?: ReactNode;
  maxWidth?: ContainerProps['maxWidth'] | false;
  children: ReactNode;
};

const PageShell: React.FC<PageShellProps> = ({ title, actions, maxWidth = APP_PAGE_FRAME.maxWidth, children }) => {
  return (
    <Container maxWidth={maxWidth} disableGutters sx={{ px: APP_PAGE_FRAME.px }}>
      <Box sx={{ py: { xs: 3, sm: 4 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Typography variant="h4" component="h1" sx={{ fontWeight: 850, lineHeight: 1.15 }}>
            {title}
          </Typography>
          {actions ? (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
                justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              }}
            >
              {actions}
            </Box>
          ) : null}
        </Stack>
        {children}
      </Box>
    </Container>
  );
};

export default PageShell;
