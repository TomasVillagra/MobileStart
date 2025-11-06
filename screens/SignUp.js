// screens/SignUp.js
import React, { useState, useMemo } from 'react';
import {
  ImageBackground,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert, 
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { auth, db } from '../src/config/firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const NAME_MIN = 3;
const NAME_MAX = 25;
const EMAIL_MAX = 30;
const PASS_MIN = 6;
const PASS_MAX = 25;

export default function SignUp({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName ] = useState('');
  const [email,     setEmail    ] = useState('');
  const [password,  setPassword ] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors,    setErrors   ] = useState({});
  const [formError, setFormError] = useState('');

  const passwordChecks = useMemo(() => {
    const hasMinLen = password.length >= PASS_MIN;
    const hasLower  = /[a-z]/.test(password);
    const hasUpper  = /[A-Z]/.test(password);
    const hasDigit  = /\d/.test(password);
    return { hasMinLen, hasLower, hasUpper, hasDigit };
  }, [password]);

  const validateFields = () => {
    setFormError('');
    if (
      (!firstName || firstName.trim() === '') &&
      (!lastName  || lastName.trim()  === '') &&
      (!email     || email.trim()     === '') &&
      (!password  || password.trim()  === '') &&
      (!confirmPassword || confirmPassword.trim() === '')
    ) {
      setFormError('Todos los campos son obligatorios');
      return false;
    }

    const newErrors = {};

    // Nombre: requerido + min/max
    if (!firstName.trim()) newErrors.firstName = 'Este campo es obligatorio.';
    else if (firstName.trim().length < NAME_MIN)
      newErrors.firstName = `Mínimo ${NAME_MIN} caracteres.`;
    else if (firstName.trim().length > NAME_MAX)
      newErrors.firstName = `Máximo ${NAME_MAX} caracteres.`;

    // Apellido: requerido + min/max
    if (!lastName.trim()) newErrors.lastName = 'Este campo es obligatorio.';
    else if (lastName.trim().length < NAME_MIN)
      newErrors.lastName = `Mínimo ${NAME_MIN} caracteres.`;
    else if (lastName.trim().length > NAME_MAX)
      newErrors.lastName = `Máximo ${NAME_MAX} caracteres.`;

    // Correo: requerido + formato + max
    if (!email.trim()) newErrors.email = 'Este campo es obligatorio.';
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (email && !emailRegex.test(email)) newErrors.email = 'Ingresá un correo válido.';
    if (email && email.length > EMAIL_MAX) newErrors.email = `Máximo ${EMAIL_MAX} caracteres.`;

    // Password: requerida + min/max + requisitos
    if (!password) newErrors.password = 'Este campo es obligatorio.';
    if (password && password.length < PASS_MIN)
      newErrors.password = `Mínimo ${PASS_MIN} caracteres.`;
    if (password && password.length > PASS_MAX)
      newErrors.password = `Máximo ${PASS_MAX} caracteres.`;
    if (
      password &&
      !(passwordChecks.hasMinLen && passwordChecks.hasLower && passwordChecks.hasUpper && passwordChecks.hasDigit)
    ) {
      newErrors.password = 'La contraseña no cumple los requisitos.';
    }

    // Confirmación: requerida + coincide
    if (!confirmPassword) newErrors.confirmPassword = 'Este campo es obligatorio.';
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    setErrors(newErrors);
    setFormError('');
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateFields()) return;

    try {
      globalThis.__signupFlow = true;

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = cred.user;

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateProfile(user, { displayName: fullName || email.split('@')[0] });

      await setDoc(doc(db, 'users', user.uid), {
        nombre: firstName.trim(),
        apellido: lastName.trim(),
        name: fullName || email.split('@')[0],
        email: email.trim(),
        createdAt: new Date(),
      });

      await auth.signOut();

      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Registro exitoso',
        'Tu cuenta fue creada correctamente. Ahora podés iniciar sesión.',
        [{ text: 'OK', onPress: () => { setTimeout(() => navigation.navigate('Login'), 0); } }]
      );
    } catch (error) {
      let errorMessage = 'Hubo un problema al registrar el usuario.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'El correo electrónico ya está en uso.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'El formato del correo electrónico no es válido.';
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña es demasiado débil.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión. Verificá tu Internet.';
          break;
      }
      setFormError(errorMessage);
    } finally {
      globalThis.__signupFlow = false;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ImageBackground source={require('../assets/fondo.png')} style={styles.background} resizeMode="cover">
        <View style={styles.customHeader}>
          <Text style={styles.customHeaderText}>Pizzeria-Rex</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />

          <View style={styles.formContainer}>
            <Text style={styles.title}>Regístrate</Text>

            {/* Nombre */}
            <View style={styles.inputContainer}>
              <FontAwesome name="user" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su nombre"
                placeholderTextColor="#aaa"
                value={firstName}
                maxLength={NAME_MAX}
                onChangeText={(v) => {
                  setFirstName(v);
                  if (errors.firstName) setErrors({ ...errors, firstName: '' });
                  setFormError('');
                }}
              />
            </View>
            {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}

            {/* Apellido */}
            <View style={styles.inputContainer}>
              <FontAwesome name="user" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su apellido"
                placeholderTextColor="#aaa"
                value={lastName}
                maxLength={NAME_MAX}
                onChangeText={(v) => {
                  setLastName(v);
                  if (errors.lastName) setErrors({ ...errors, lastName: '' });
                  setFormError('');
                }}
              />
            </View>
            {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}

            {/* Correo */}
            <View style={styles.inputContainer}>
              <FontAwesome name="envelope" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su correo"
                placeholderTextColor="#aaa"
                value={email}
                maxLength={EMAIL_MAX}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors({ ...errors, email: '' });
                  setFormError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

            {/* Contraseña */}
            <View style={styles.inputContainer}>
              <FontAwesome name="lock" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su contraseña"
                placeholderTextColor="#aaa"
                value={password}
                maxLength={PASS_MAX}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors({ ...errors, password: '' });
                  setFormError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="oneTimeCode"
                importantForAutofill="no"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <FontAwesome name={showPassword ? 'eye-slash' : 'eye'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

            {/* Requisitos */}
            <Text style={styles.passwordTitle}>La contraseña debe tener:</Text>
            <View style={styles.passwordHints}>
              <Hint ok={passwordChecks.hasMinLen} text={`Mínimo ${PASS_MIN} caracteres`} />
              <Hint ok={passwordChecks.hasLower}  text="Una minúscula" />
              <Hint ok={passwordChecks.hasUpper}  text="Una mayúscula" />
              <Hint ok={passwordChecks.hasDigit}  text="Un número" />
            </View>

            {/* Confirmación */}
            <View style={styles.inputContainer}>
              <FontAwesome name="lock" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Confirme su contraseña"
                placeholderTextColor="#aaa"
                value={confirmPassword}
                maxLength={PASS_MAX}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                  setFormError('');
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="oneTimeCode"
                importantForAutofill="no"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <FontAwesome name={showConfirmPassword ? 'eye-slash' : 'eye'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}

            {/* Error global (Obligatorios / backend) */}
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleSignUp}>
              <Text style={styles.buttonText}>Registrarse</Text>
            </TouchableOpacity>

            <Text style={styles.signInLine}>
              ¿Ya tenés cuenta?{' '}
              <Text style={styles.signInLink} onPress={() => navigation.navigate('Login')}>
                Inicia sesión
              </Text>
            </Text>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

function Hint({ ok, text }) {
  return (
    <View style={styles.hintItem}>
      <FontAwesome name={ok ? 'check-circle' : 'circle-o'} size={14} color={ok ? '#8be28b' : '#cf0707ff'} />
      <Text style={[styles.hintText, ok && { color: '#8be28b' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, 
    width: '100%', 
    height: '100%' },
  customHeader: { position: 'absolute', 
    top: 0, 
    width: '100%',
     paddingVertical: 15, 
     paddingTop: 25, 
     backgroundColor: 'rgba(0,0,0,0.65)', 
     alignItems: 'center', 
     zIndex: 1 },
  customHeaderText: { color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' },
  scrollContainer: { flexGrow: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingTop: 100, 
    paddingBottom: 20 },
  logo: { width: 300, 
    height: 150, 
    marginBottom: 20, 
    transform: [{ translateY: -80 }] },
  formContainer: { backgroundColor: 'rgba(0,0,0,0.65)', 
    padding: 20, 
    borderRadius: 10, 
    width: '85%', 
    marginBottom: 20, 
    transform: [{ translateY: -80 }] },
  title: { fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff', 
    textAlign: 'center', 
    marginBottom: 12 },
  fieldError: { color: '#ff6b6b', 
    fontSize: 12, 
    marginTop: -12, 
    marginBottom: 12 },
  inputContainer: { flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderColor: '#fff', 
    marginBottom: 20 },
  icon: { marginRight: 10 },
  input: { flex: 1, 
    color: '#fff', 
    paddingVertical: 8 },
  passwordHints: { marginTop: -10,
     marginBottom: 10 },
  hintItem: { flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 4 },
  hintText: { color: '#ddd', 
    fontSize: 12 },
  button: { backgroundColor: '#c62828', 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 9999, 
    alignItems: 'center', 
    alignSelf: 'center', 
    width: '70%', 
    marginTop: 10 },
  buttonText: { color: '#fff', 
    fontSize: 15, 
    fontWeight: 'bold' },
  passwordTitle: { color: '#ddd', 
    fontWeight: 'bold', 
    marginTop: 2, 
    marginBottom: 4, 
    fontSize: 12 },
  signInLine: { marginTop: 15, 
    color: '#fff', 
    textAlign: 'center' },
  signInLink: { color: '#ff0000ff', 
    fontWeight: 'bold' },
  formError: { color: '#ff6b6b', 
    textAlign: 'center', 
    marginBottom: 10, 
    fontWeight: 'bold', 
    fontSize: 14 },
});












