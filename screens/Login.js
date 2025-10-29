// Login.js
import React, { useEffect, useState } from "react";
import { 
  ImageBackground, 
  Image, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  View, 
  StyleSheet, 
  KeyboardAvoidingView,
  ScrollView,
  Platform
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup, 
} from "firebase/auth";
import { auth } from "../src/config/firebaseConfig";

// Expo Auth Session (Google)
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";

if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  //  constantes para web / redirect
  const isWeb = Platform.OS === "web";
  const redirectUri = "https://auth.expo.io/@TomasVillagra/mobileStart";

  // REEMPLAZADO: hook de Google con scopes + responseType + redirectUri
  const [request, response, promptAsync] = isWeb
    ? [null, null, async () => {}] 
    : Google.useAuthRequest({
       
        expoClientId:
          "760370524623-lnhvkq0gjs99ggra9kij5i0uovrcp7vq.apps.googleusercontent.com",
        
        iosClientId: "760370524623-5u29vsm2j39pso13p0g0egn1i3mvrrhu.apps.googleusercontent.com",
        //androidClientId: "",
        
        webClientId:
          "760370524623-lnhvkq0gjs99ggra9kij5i0uovrcp7vq.apps.googleusercontent.com",
        
        
        scopes: ["openid", "profile", "email"],
        responseType: "id_token",
        redirectUri,
      });


  useEffect(() => {
    if (!isWeb) {
      console.log("redirectUri:", redirectUri);
      console.log("AuthRequest OK:", !!request);
    }
  }, [request]);

  // procesar respuesta (con fallback a accessToken)
  useEffect(() => {
    const go = async () => {
      if (isWeb || response?.type !== "success") return;

      const idToken =
        response?.authentication?.idToken ?? response?.params?.id_token ?? null;
      const accessToken =
        response?.authentication?.accessToken ??
        response?.params?.access_token ??
        null;

      if (!idToken && !accessToken) {
        setLoginError("No se recibió token de Google (idToken/accessToken).");
        return;
      }

      const credential = idToken
        ? GoogleAuthProvider.credential(idToken)
        : GoogleAuthProvider.credential(null, accessToken);

      await signInWithCredential(auth, credential);
    };

    go().catch((e) => {
      console.log(e);
      setLoginError("No se pudo iniciar sesión con Google.");
    });
  }, [response]);

  // Login con email y contraseña
  const handleLogin = async () => {
    setLoginError("");

    if (!email || !password) {
      setLoginError("Por favor ingrese correo y contraseña.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoginError("Correo o contraseña incorrectos.");
    }
  };

  // Google → WEB usa Popup / MÓVIL usa AuthSession
  const handleGoogleLogin = async () => {
    setLoginError("");
    try {
      if (isWeb) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);

      } else {
        await promptAsync({ useProxy: true, redirectUri });
      }
    } catch (e) {
      console.log(e);
      setLoginError("No se pudo iniciar sesión con Google.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: "padding" })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 110 })}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <ImageBackground
          source={require("../assets/fondo.png")}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.customHeader}>
            <Text style={styles.customHeaderText}>Pizzeria-Rex</Text>
          </View>

          <Image 
            source={require("../assets/logo.png")} 
            style={styles.logo}
            resizeMode="contain"
          />
      
          <View style={styles.formContainer}>
            <Text style={styles.title}>Iniciar Sesión</Text>

            {/* Email */}
            <View style={styles.inputContainer}>
              <FontAwesome name="envelope" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su correo"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <FontAwesome name="lock" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su contraseña"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

            {/* Botón login */}
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Ingresar</Text>
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>O</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Botón Google */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={!isWeb && !request}
            >
              <FontAwesome name="google" size={20} color="#4285f4" style={styles.googleIcon} />
              <Text style={styles.googleButtonText}></Text>
            </TouchableOpacity>

            {/* Crear cuenta */}
            <Text style={styles.signUpLine}>
              ¿No tenés cuenta aún?{" "}
              <Text
                style={styles.signUpLink}
                onPress={() => navigation.navigate("SignUp")}
              >
                Regístrate
              </Text>
            </Text>
          </View>
        </ImageBackground>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { 
    flex: 1, 
    width: "100%", 
    height: "100%", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  logo: { 
    width: 300, 
    height: 150, 
    marginBottom: 15,
    alignSelf: "center",
    maxWidth: 420,
    transform: [{ translateY: -80 }],
  },
  customHeader: { 
    position: "absolute", 
    top: 0, 
    width: "100%", 
    paddingVertical: 15, 
    backgroundColor: "rgba(0,0,0,0.65)", 
    alignItems: "center" 
  },
  customHeaderText: { 
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "bold" 
  },
  formContainer: { 
    backgroundColor: "rgba(0,0,0,0.65)", 
    padding: 50, 
    borderRadius: 10,
    width: "80%", 
    alignSelf: "center",
    maxWidth: 420,
    transform: [{ translateY: -80 }],
  },
  title: { 
    fontSize: 20, 
    fontWeight: "bold", 
    color: "#fff", 
    textAlign: "center", 
    marginBottom: 20 
  },
  errorText: {
    color: "#ff6b6b",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 14,
    fontWeight: "bold",
  },
  inputContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderBottomWidth: 1, 
    borderColor: "#fff", 
    marginBottom: 20 
  },
  icon: { 
    marginRight: 10 
  },
  input: { 
    flex: 1, 
    color: "#fff", 
    paddingVertical: 8 
  },
  button: {
    backgroundColor: "#C51F1F",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 9999,
    alignItems: "center",
    alignSelf: "center",
    width: "70%",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  separatorContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginVertical: 20 
  },
  separatorLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: "#fff", 
    opacity: 0.3 
  },
  separatorText: { 
    color: "#fff", 
    paddingHorizontal: 15, 
    fontSize: 14 
  },
  googleButton: { 
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 9999,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    alignSelf: "center",
    width: "70%",
    marginBottom: 10,
  },
  googleIcon: { 
    marginRight: 10 
  },
  googleButtonText: { 
    color: "#333",
    fontSize: 15,
    fontWeight: "bold",
  },
  signUpText: { 
    marginTop: 15,
    color: "#ffb74d",
    textAlign: "center",
    textDecorationLine: "underline",  
  },
  signUpText1: { 
    marginTop: 15,
    color: "#ffb74d",
    textAlign: "center",
  },
  signUpLine: {
    marginTop: 15,
    color: "#edededff",
    textAlign: "center",
  },
  signUpLink: {
    color: "#f40606ff",
    
    fontWeight: "bold",
  },
});

