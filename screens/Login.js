// Login.js — "obligatorio" solo al enviar + validación en tiempo real
// y "Correo o contraseña incorrectos" SOLO si email y password están completos
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
  Platform,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/config/firebaseConfig";

const HEADER_HEIGHT = 60; 
const EMAIL_MIN = 13;
const EMAIL_MAX = 30;
const PASS_MIN = 6;
const PASS_MAX = 25;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // controla cuándo mostrar "obligatorio"
  const [submitted, setSubmitted] = useState(false);

  // errores por campo + error de login del servidor
  const [errors, setErrors] = useState({ email: "", password: "", login: "" });

  // validación en tiempo real (formato/longitud). "Obligatorio" solo al enviar.
  useEffect(() => {
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    const e = { email: "", password: "" };

    // EMAIL
    if (trimmedEmail) {
      if (trimmedEmail.length < EMAIL_MIN)
        e.email = `El correo debe tener al menos ${EMAIL_MIN} caracteres.`;
      else if (trimmedEmail.length > EMAIL_MAX)
        e.email = `El correo no puede superar ${EMAIL_MAX} caracteres.`;
      else if (!emailRegex.test(trimmedEmail))
        e.email = "Formato de correo inválido.";
    } else if (submitted) {
      e.email = "El correo es obligatorio.";
    }

    // PASSWORD
    if (trimmedPass) {
      if (trimmedPass.length < PASS_MIN)
        e.password = `La contraseña debe tener al menos ${PASS_MIN} caracteres.`;
      else if (trimmedPass.length > PASS_MAX)
        e.password = `La contraseña no puede superar ${PASS_MAX} caracteres.`;
    } else if (submitted) {
      e.password = "La contraseña es obligatoria.";
    }

    // 
    setErrors((prev) => ({ ...prev, email: e.email, password: e.password }));
  }, [email, password, submitted]);

  const handleLogin = async () => {
    setSubmitted(true); // activa mensajes "obligatorio" si hay vacíos

    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    // Si falta alguno, NO mostramos error de credenciales
    if (!trimmedEmail || !trimmedPass) {
      setErrors((prev) => ({ ...prev, login: "" }));
      return;
    }

    // Si hay errores de formato/longitud, tampoco intentamos login ni mostramos error de credenciales
    if (errors.email || errors.password) {
      setErrors((prev) => ({ ...prev, login: "" }));
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPass);
      // navegación la maneja el observer de auth
    } catch (error) {
      // Solo aca, con ambos campos completos y válidos, mostramos el error de credenciales
      setErrors((prev) => ({
        ...prev,
        login: "Correo o contraseña incorrectos.",
      }));
    }
  };

  // Al escribir, limpiamos el error de credenciales (para no mostrarlo con un solo campo)
  const onChangeEmail = (t) => {
    setEmail(t.replace(/\s+/g, "").slice(0, EMAIL_MAX));
    if (errors.login) setErrors((prev) => ({ ...prev, login: "" }));
  };
  const onChangePass = (t) => {
    setPassword(t.slice(0, PASS_MAX));
    if (errors.login) setErrors((prev) => ({ ...prev, login: "" }));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        bounces={false}
      >
        <ImageBackground
          source={require("../assets/fondo.png")}
          style={styles.background}
          resizeMode="cover"
        >
          {/* Header */}
          <View style={styles.customHeader}>
            <Text style={styles.customHeaderText}>Pizzeria-Rex</Text>
          </View>

          {/* Contenido centrado y subido */}
          <View style={styles.contentWrapper}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.formContainer}>
              <Text style={styles.title}>Iniciar Sesión</Text>

              {/* EMAIL */}
              <View style={styles.inputContainer}>
                <FontAwesome name="envelope" size={20} color="#fff" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese su correo"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={onChangeEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

              {/* PASSWORD */}
              <View style={styles.inputContainer}>
                <FontAwesome name="lock" size={20} color="#fff" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese su contraseña"
                  placeholderTextColor="#aaa"
                  value={password}
                  onChangeText={onChangePass}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

              {!!errors.login && <Text style={styles.errorText}>{errors.login}</Text>}

              {/* Botón */}
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Ingresar</Text>
              </TouchableOpacity>

              {/* Crear cuenta */}
              <Text style={styles.signUpLine}>
                ¿No tenés cuenta aún?{" "}
                <Text style={styles.signUpLink} onPress={() => navigation.navigate("SignUp")}>
                  Regístrate
                </Text>
              </Text>
            </View>
          </View>
        </ImageBackground>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  contentWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: HEADER_HEIGHT - 50, //  para subir logo hacia arriba
    paddingBottom: 32,
  },
  customHeader: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: HEADER_HEIGHT,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  customHeaderText: { color: "#fff", 
    fontSize: 18, 
    fontWeight: "bold" },

  logo: { width: 280, 
    height: 140, 
    marginBottom: 10, 
    alignSelf: "center" },

  formContainer: {
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 28,
    borderRadius: 12,
    width: "80%",
    alignSelf: "center",
    maxWidth: 420,
  },
  title: { fontSize: 20, 
    fontWeight: "bold", 
    color: "#fff", 
    textAlign: "center", 
    marginBottom: 18 },
  fieldError: { color: "#ffb3b3", 
    fontSize: 12, 
    marginTop: -6, 
    marginBottom: 8 },
  errorText: { color: "#ff6b6b", 
    textAlign: "center", 
    marginBottom: 15, 
    fontSize: 14, 
    fontWeight: "bold" },
  inputContainer: {
    flexDirection: "row", 
    alignItems: "center",
    borderBottomWidth: 1, 
    borderColor: "#fff",
    marginBottom: 20,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, 
    color: "#fff", 
    paddingVertical: 8 },
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
  buttonText: { color: "#fff", 
    fontSize: 15, 
    fontWeight: "bold" },
  signUpLine: { marginTop: 15, 
    color: "#edededff", 
    textAlign: "center" },
  signUpLink: { color: "#f40606ff", 
    fontWeight: "bold" },
});














