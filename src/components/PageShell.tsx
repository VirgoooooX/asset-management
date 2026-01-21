import React, { ReactNode } from 'react';
import { Box, Container, ContainerProps, Stack, Typography } from '@mui/material';

type PageShellProps = {
  title: ReactNode;
  actions?: ReactNode;
  maxWidth?: ContainerProps['maxWidth'] | false;
  children: ReactNode;
};

const PageShell: React.FC<PageShellProps> = ({ title, actions, maxWidth = 'lg', children }) => {
  return (
    <Container maxWidth={maxWidth}>
      <Box sx={{ py: { xs: 3, sm: 4 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {actions ? <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>{actions}</Box> : null}
        </Stack>
        {children}
      </Box>
    </Container>
  );
};

export default PageShell;

