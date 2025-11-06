// Perfil.js — foto circular + sin mensaje "Revisá los campos marcados"
import React, { useCallback, useState, useEffect } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import { useIsFocused } from '@react-navigation/native';

import { auth, db } from '../src/config/firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ====== CLOUDINARY (tus valores) ======
const CLOUD_NAME = 'ddyf7ez3d';
const UPLOAD_PRESET = 'Upload';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// Reglas de validación 
const NAME_MIN = 3;
const NAME_MAX = 30;
const nameRegex = /^[a-zA-Z\sñÑ\u00C0-\u017F]+$/;

export default function Perfil() {
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Nombre mostrado y estados separados
  const [name, setName] = useState('Usuario');
  const [firstName, setFirstName] = useState(''); // nombre
  const [lastName, setLastName] = useState('');   // apellido

  const [email, setEmail] = useState('—');

  // Foto guardada y preview local
  const [photoURL, setPhotoURL] = useState(null);     // URL ya guardada
  const [tempLocalUri, setTempLocalUri] = useState(null); // preview (no guardada hasta "Guardar")

  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');

  // Errores de campos (debajo en rojo) — sin "form"
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    phone: '',
  });

  // ---- helpers
  const hasInternet = async () => {
    const s = await Network.getNetworkStateAsync();
    return Boolean(s.isConnected && s.isInternetReachable);
  };

  const ensureMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para elegir una foto.');
      return false;
    }
    return true;
  };

  const ensureCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar una foto.');
      return false;
    }
    return true;
  };

  // ---- cargar datos almacenados
  const loadUser = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setEmail(user.email || '—');

      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { email: user.email, createdAt: new Date() }, { merge: true });
      }
      const data = (await getDoc(ref)).data() || {};

      const loadedFirst = data?.nombre ?? data?.firstName ?? '';
      const loadedLast  = data?.apellido ?? data?.lastName ?? '';

      setFirstName(loadedFirst);
      setLastName(loadedLast);

      const fullNameFromSignup =
        loadedFirst && loadedLast ? `${loadedFirst} ${loadedLast}`.trim() : null;

      const computedName =
        fullNameFromSignup ||
        data?.name ||
        user.displayName ||
        (user.email ? user.email.split('@')[0] : 'Usuario');

      setName(computedName);
      setPhotoURL(user.photoURL || data?.photoURL || null);
      setTempLocalUri(null); // al entrar, sin cambios locales

      setDni(data?.dni ?? data?.DNI ?? '');
      setPhone(data?.phone ?? data?.telefono ?? user.phoneNumber ?? '');
    } catch (e) {
      console.log('loadUser error >>>', e);
      if (String(e).includes('Missing or insufficient permissions')) {
        Alert.alert('Permisos Firestore', 'Revisá y publicá las Reglas de Firestore para users/{uid}.');
      }
    }
  }, []);

  useEffect(() => {
    if (isFocused) loadUser();
  }, [isFocused, loadUser]);

  // elegir desde galería (solo preview local, NO sube)
  const pickImageFromGallery = async () => {
    try {
      const ok = await ensureMediaLibraryPermission();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // cuadrado
        quality: 0.8,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      // solo PREVIEW local; guardamos en Cloudinary al presionar "Guardar"
      setTempLocalUri(uri);
    } catch (e) {
      console.log('[Picker] galería error:', e);
      Alert.alert('Error', 'No se pudo abrir la galería.');
    }
  };

  // tomar foto (solo preview local, NO sube)
  const takePhotoWithCamera = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      // solo PREVIEW local
      setTempLocalUri(uri);
    } catch (e) {
      console.log('[Picker] cámara error:', e);
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  };

  // ---- subir a cloudinary (se llama SOLO si tocás Guardar y hay tempLocalUri)
  const uploadProfileImageToCloudinary = async (uri) => {
    if (!(await hasInternet())) {
      Alert.alert('Sin conexión', 'Revisá tu Internet e intentá de nuevo.');
      return null;
    }
    try {
      const data = new FormData();
      data.append('file', { uri, type: 'image/jpeg', name: 'profile.jpg' });
      data.append('upload_preset', UPLOAD_PRESET);
      data.append('folder', 'users');

      const res = await fetch(UPLOAD_URL, { method: 'POST', body: data });
      const json = await res.json();
      if (!json?.secure_url) throw new Error('No se recibió secure_url');
      return json.secure_url;
    } catch (e) {
      console.log('uploadProfileImageToCloudinary error >>>', e);
      Alert.alert('Error', 'No se pudo subir la imagen.');
      return null;
    }
  };

  // ---- validaciones (sin Alert, muestran error bajo el campo)
  const validateFields = () => {
    const e = { firstName: '', lastName: '', dni: '', phone: '' };

    const fnRaw = firstName ?? '';
    const lnRaw = lastName ?? '';

    const fn = fnRaw.trim();
    const ln = lnRaw.trim();

    // nombre
    if (/^\s/.test(fnRaw)) e.firstName = 'No puede comenzar con espacio.';
    if (!fn) e.firstName ||= 'El nombre es obligatorio.';
    else if (fn.length < NAME_MIN) e.firstName = `Mínimo ${NAME_MIN} caracteres.`;
    else if (fn.length > NAME_MAX) e.firstName = `Máximo ${NAME_MAX} caracteres.`;
    else if (!nameRegex.test(fn)) e.firstName = 'Sólo letras y espacios.';

    // apellido
    if (/^\s/.test(lnRaw)) e.lastName = 'No puede comenzar con espacio.';
    if (!ln) e.lastName ||= 'El apellido es obligatorio.';
    else if (ln.length < NAME_MIN) e.lastName = `Mínimo ${NAME_MIN} caracteres.`;
    else if (ln.length > NAME_MAX) e.lastName = `Máximo ${NAME_MAX} caracteres.`;
    else if (!nameRegex.test(ln)) e.lastName = 'Sólo letras y espacios.';

    // DNI (opcional): 7-8 dígitos
    const dniClean = String(dni || '').trim();
    if (dniClean && !/^\d{7,8}$/.test(dniClean)) {
      e.dni = 'El DNI debe tener 7 u 8 dígitos numéricos o quedar vacío.';
    }

    // Teléfono (opcional): 8–15 dígitos, + opcional
    const phoneClean = String(phone || '').replace(/\s+/g, '');
    if (phoneClean && !/^\+?\d{8,15}$/.test(phoneClean)) {
      e.phone = 'Sólo números, 8–15 dígitos (puede iniciar con +54).';
    }

    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  // ====== CAMBIO SOLICITADO: confirmación antes de guardar ======
  const proceedSave = async () => {
    if (!(await hasInternet())) {
      Alert.alert('Sin conexión', 'Revisá tu Internet e intentá de nuevo.');
      return;
    }
    if (!validateFields()) return;

    try {
      setLoading(true);

      // 1) Subir imagen si hay preview local pendiente
      let finalPhotoURL = photoURL;
      if (tempLocalUri) {
        const uploaded = await uploadProfileImageToCloudinary(tempLocalUri);
        if (uploaded) {
          finalPhotoURL = uploaded;
        } else {
          setLoading(false);
          return;
        }
      }

      // 2) Persistir datos
      const fn = firstName.trim();
      const ln = lastName.trim();
      const display = `${fn} ${ln}`.trim();

      await updateProfile(auth.currentUser, { displayName: display, photoURL: finalPhotoURL || null });

      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          nombre: fn,
          apellido: ln,
          name: display,
          dni: String(dni || '').trim(),
          phone: String(phone || '').replace(/\s+/g, ''),
          email: auth.currentUser.email,
          photoURL: finalPhotoURL || null,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      await auth.currentUser.reload();
      setName(display);
      setPhotoURL(finalPhotoURL || null);
      setTempLocalUri(null);
      setIsEditing(false);
      Alert.alert('Listo', 'Perfil actualizado');
    } catch (e) {
      console.log('handleSave error >>>', e);
      if (String(e).includes('Missing or insufficient permissions')) {
        Alert.alert('Permisos Firestore', 'Tus reglas no permiten escribir en users/{uid}.');
      } else {
        Alert.alert('Error', 'No se pudo guardar los datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    Alert.alert(
      'Confirmación',
      '¿Estás seguro que quieres hacer estos cambios?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Guardar', onPress: proceedSave },
      ],
      { cancelable: true }
    );
  };
  // ====== FIN CAMBIO ======

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          {/* Foto CIRCULAR: si hay preview local la muestro; si no, la guardada */}
          {tempLocalUri ? (
            <Image source={{ uri: tempLocalUri }} style={styles.avatarCircle} />
          ) : photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarCircle} />
          ) : (
            <View style={styles.avatarCircleFallback}>
              <FontAwesome name="user" size={28} color="#EDEDED" />
            </View>
          )}

          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.sub}>{email}</Text>
          </View>

          {/* Acciones foto (solo en edición) */}
          {isEditing && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={pickImageFromGallery} disabled={loading}>
                {loading ? <ActivityIndicator /> : <FontAwesome name="picture-o" size={20} color="#FFD54F" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhotoWithCamera} disabled={loading}>
                {loading ? <ActivityIndicator /> : <FontAwesome name="camera" size={20} color="#FFD54F" />}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Vista o edición */}
        {!isEditing ? (
          <>
            {/* Mostrar DNI solo si existe */}
            {dni ? (
              <View style={styles.row}>
                <FontAwesome name="id-card" size={16} color="#CFCFCF" />
                <Text style={styles.label}>DNI</Text>
                <Text style={styles.value}>{dni}</Text>
              </View>
            ) : null}

            {/* Mostrar Teléfono solo si existe */}
            {phone ? (
              <View style={styles.row}>
                <FontAwesome name="mobile" size={16} color="#CFCFCF" />
                <Text style={styles.label}>Teléfono</Text>
                <Text style={styles.value}>{phone}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsEditing(true)}>
              <FontAwesome name="pencil" size={16} color="#0D0D0D" />
              <Text style={styles.primaryBtnText}>Editar perfil</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ marginTop: 12 }}>
            {/* Nombre */}
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={[styles.input, errors.firstName && styles.inputError]}
              value={firstName}
              onChangeText={(t) => {
                const clean = t.replace(/^\s+/, ''); // sin espacio inicial
                setFirstName(clean.slice(0, NAME_MAX)); // limite caracteres
                setErrors((e) => ({ ...e, firstName: '' }));
                setName(`${clean} ${lastName}`.trim());
              }}
              onBlur={validateFields}
              placeholder="Tu nombre"
              placeholderTextColor="#888"
              maxLength={NAME_MAX}
            />
            {!!errors.firstName && <Text style={styles.fieldError}>{errors.firstName}</Text>}

            {/* Apellido */}
            <Text style={styles.inputLabel}>Apellido</Text>
            <TextInput
              style={[styles.input, errors.lastName && styles.inputError]}
              value={lastName}
              onChangeText={(t) => {
                const clean = t.replace(/^\s+/, '');
                setLastName(clean.slice(0, NAME_MAX));
                setErrors((e) => ({ ...e, lastName: '' }));
                setName(`${firstName} ${clean}`.trim());
              }}
              onBlur={validateFields}
              placeholder="Tu apellido"
              placeholderTextColor="#888"
              maxLength={NAME_MAX}
            />
            {!!errors.lastName && <Text style={styles.fieldError}>{errors.lastName}</Text>}

            {/* DNI */}
            <Text style={styles.inputLabel}>DNI</Text>
            <TextInput
              style={[styles.input, errors.dni && styles.inputError]}
              value={dni}
              onChangeText={(t) => {
                setDni(t);
                setErrors((e) => ({ ...e, dni: '' }));
              }}
              onBlur={validateFields}
              placeholder="DNI (7 u 8 dígitos)"
              placeholderTextColor="#888"
              keyboardType="number-pad"
              maxLength={8}
            />
            {!!errors.dni && <Text style={styles.fieldError}>{errors.dni}</Text>}

            {/* Teléfono */}
            <Text style={styles.inputLabel}>Teléfono</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors((e) => ({ ...e, phone: '' }));
              }}
              onBlur={validateFields}
              placeholder="Teléfono (solo números, ej. +549...)"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              maxLength={16}
            />
            {!!errors.phone && <Text style={styles.fieldError}>{errors.phone}</Text>}

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, opacity: loading ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <ActivityIndicator /> : <FontAwesome name="save" size={16} color="#0D0D0D" />}
                <Text style={styles.primaryBtnText}>{loading ? 'Guardando…' : 'Guardar'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1, marginLeft: 10 }]}
                onPress={() => {
                  setIsEditing(false);
                  setErrors({ firstName: '', lastName: '', dni: '', phone: '' });
                  setTempLocalUri(null); // descartamos preview local
                  // re-cargar por si hubo cambios en otra vista
                  loadUser();
                }}
                disabled={loading}
              >
                <FontAwesome name="times" size={16} color="#000" />
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  container: { flex: 1, 
    padding: 18,
    backgroundColor: '#000' },

  card: {
    backgroundColor: 'rgba(28,28,30,0.98)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  header: { flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 },

  // Foto CIRCULAR
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  avatarCircleFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: { color: '#FFF', 
    fontSize: 18, 
    fontWeight: '800' },

  sub: { color: '#BDBDBD', 
    fontSize: 13,
     marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  label: { color: '#E0E0E0', 
    fontSize: 14, 
    marginLeft: 10, 
    width: 90 },

  value: { color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: '700', 
    flex: 1 },

  primaryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD54F',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#0D0D0D', 
    fontWeight: '800', 
    marginLeft: 8 },

  cancelBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#000', 
    fontWeight: '800', 
    marginLeft: 8 },

  // Inputs + errores
  inputLabel: { color: '#FFD54F', 
    marginBottom: 4, 
    marginTop: 8, 
    fontWeight: '700' },
    
  input: {
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  fieldError: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
  },
});



