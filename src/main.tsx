import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { store } from './store'; // Adjust this import based on your store location
import App from './App';
import './index.css';
import { createAppTheme } from './theme'
import { useAppSelector } from './store/hooks'

const ThemedApp: React.FC = () => {
  const settings = useAppSelector((s) => s.settings)
  const theme = React.useMemo(
    () => createAppTheme({ themeMode: settings.themeMode, density: settings.density, primaryColor: settings.primaryColor }),
    [settings.density, settings.primaryColor, settings.themeMode]
  )
  return (
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  </React.StrictMode>
);
