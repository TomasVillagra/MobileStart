// navigation/Navigation.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig';

import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import Home from '../screens/Home';
import Perfil from '../screens/Perfil';
import Inventario from '../screens/Inventario';
import AgregarInsumo from '../screens/AgregarInsumo';
import EditarInsumo from '../screens/EditarInsumo';
import DetalleInsumo from '../screens/DetalleInsumo';
const Stack = createStackNavigator();

export default function Navigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      // Durante el registro, ignorar el "user" temporal hasta que SignUp haga signOut()
      if (globalThis.__signupFlow && user) return;
      setIsAuthenticated(!!user);
    });
    return unsub;
  }, []);

  if (isAuthenticated === null) return null;

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator>
          
          <Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />
          <Stack.Screen
            name="Perfil"
            component={Perfil}
            options={{
              title: 'Mi perfil',
              headerStyle: { backgroundColor: '#000' },
              headerTintColor: '#FFD54F',
            }}
          />
          <Stack.Screen
            name="Inventario"
            component={Inventario}
            options={{
              title: '',
              headerStyle: { backgroundColor: '#000' },
              headerTintColor: '#FFD54F',
              
            }}
          />
          <Stack.Screen
            name="AgregarInsumo"
            component={AgregarInsumo}
            options={{
              title: '',
              headerStyle: { backgroundColor: '#000' },
              headerTintColor: '#FFD54F',
            }}
          />
          <Stack.Screen
          name="EditarInsumo"
          component={EditarInsumo}
          options={{ title: '', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#FFD54F' }}
        />
          <Stack.Screen 
        name="DetalleInsumo" 
        component={DetalleInsumo}
        options={{ title: '', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#FFD54F' }}
        />
        </Stack.Navigator>
        
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="SignUp" component={SignUp} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}


