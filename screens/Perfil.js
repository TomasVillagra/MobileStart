import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
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

export default function Perfil() {
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Nombre mostrado (derivado de nombre+apellido) y estados separados
  const [name, setName] = useState('Usuario');
  const [firstName, setFirstName] = useState(''); // nombre
  const [lastName, setLastName] = useState('');   // apellido

  const [email, setEmail] = useState('—');
  const [photoURL, setPhotoURL] = useState(null);
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');

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

  // ---- cargar datos almacenados (prioriza nombre+apellido del registro)
  const loadUser = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setEmail(user.email || '—');

      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // crea doc base si no existe (no toca nombre/apellido)
        await setDoc(ref, { email: user.email, createdAt: new Date() }, { merge: true });
      }

      const data = (await getDoc(ref)).data() || {};

      // Cargar first/last desde Firestore (acepta alias)
      const loadedFirst =
        data?.nombre ??
        data?.firstName ??
        '';
      const loadedLast =
        data?.apellido ??
        data?.lastName ??
        '';

      setFirstName(loadedFirst);
      setLastName(loadedLast);

      // Nombre preferente: nombre + apellido -> name -> displayName -> email local-part
      const fullNameFromSignup =
        loadedFirst && loadedLast ? `${loadedFirst} ${loadedLast}`.trim() : null;

      const computedName =
        fullNameFromSignup ||
        data?.name ||
        user.displayName ||
        (user.email ? user.email.split('@')[0] : 'Usuario');

      setName(computedName);
      setPhotoURL(user.photoURL || data?.photoURL || null);

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

  // ---- elegir desde galería (solo en edición)
  const pickImageFromGallery = async () => {
    try {
      const ok = await ensureMediaLibraryPermission();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // compat
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      await uploadProfileImageToCloudinary(uri);
    } catch (e) {
      console.log('[Picker] galería error:', e);
      Alert.alert('Error', 'No se pudo abrir la galería.');
    }
  };

  // ---- tomar foto con cámara (solo en edición)
  const takePhotoWithCamera = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      await uploadProfileImageToCloudinary(uri);
    } catch (e) {
      console.log('[Picker] cámara error:', e);
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  };

  // ---- subir a cloudinary + guardar URL
  const uploadProfileImageToCloudinary = async (uri) => {
    if (!(await hasInternet())) {
      Alert.alert('Sin conexión', 'Revisa tu Internet e intenta de nuevo.');
      return;
    }
    try {
      setLoading(true);

      const data = new FormData();
      data.append('file', { uri, type: 'image/jpeg', name: 'profile.jpg' });
      data.append('upload_preset', UPLOAD_PRESET);
      data.append('folder', 'users');

      const res = await fetch(UPLOAD_URL, { method: 'POST', body: data });
      const json = await res.json();

      if (!json?.secure_url) throw new Error('No se recibió secure_url');
      const finalURL = json.secure_url;

      await updateProfile(auth.currentUser, { photoURL: finalURL });
      await setDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: finalURL, updatedAt: new Date() }, { merge: true });

      await auth.currentUser.reload();
      setPhotoURL(finalURL);
      Alert.alert('Listo', 'Foto de perfil actualizada');
    } catch (e) {
      console.log('uploadProfileImageToCloudinary error >>>', e);
      Alert.alert('Error', 'No se pudo subir la imagen.');
    } finally {
      setLoading(false);
    }
  };

  // ---- guardar cambios (Nombre/Apellido/DNI/Teléfono) con validaciones
  const handleSave = async () => {
    if (!(await hasInternet())) {
      Alert.alert('Sin conexión', 'Revisa tu Internet e intenta de nuevo.');
      return;
    }

    const dniClean = String(dni || '').trim();
    const phoneClean = String(phone || '').replace(/\s+/g, '');
    const fn = String(firstName || '').trim();
    const ln = String(lastName || '').trim();

    // Validaciones
    if (fn.length < 2 || ln.length < 2) {
  Alert.alert('Error', 'Completá Nombre y Apellido (mínimo 2 caracteres cada uno).');
  return;
    }

    // DNI: permitir vacío, o 7-8 dígitos
    if (dniClean && !/^\d{7,8}$/.test(dniClean)) {
      Alert.alert('Error', 'El DNI debe contener 7 u 8 dígitos numéricos o quedar vacío.');
      return;
    }

    // Teléfono: permitir vacío, o 8–15 dígitos (+ opcional)
    if (phoneClean && !/^\+?\d{8,15}$/.test(phoneClean)) {
      Alert.alert('Error', 'El teléfono debe contener solo números (puede incluir +54) y tener 8–15 dígitos o quedar vacío.');
      return;
    }

    try {
      setLoading(true);

      const display = `${fn} ${ln}`.trim();

      // Actualizamos Auth para que toda la app vea el nombre correcto
      await updateProfile(auth.currentUser, { displayName: display });

      // Guardamos en Firestore nombre/apellido separados y un "name" combinado para conveniencia
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          nombre: fn,
          apellido: ln,
          name: display,
          dni: dniClean,
          phone: phoneClean,
          email: auth.currentUser.email,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Refrescamos estados
      await auth.currentUser.reload();
      setName(display);
      setFirstName(fn);
      setLastName(ln);
      setDni(dniClean);
      setPhone(phoneClean);

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

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
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
            {/* Nombre y Apellido separados */}
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                setName(`${t} ${lastName}`.trim());
              }}
              placeholder="Tu nombre"
              placeholderTextColor="#888"
            />

            <Text style={styles.inputLabel}>Apellido</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={(t) => {
                setLastName(t);
                setName(`${firstName} ${t}`.trim());
              }}
              placeholder="Tu apellido"
              placeholderTextColor="#888"
            />

            {/* DNI */}
            <Text style={styles.inputLabel}>DNI</Text>
            <TextInput
              style={styles.input}
              value={dni}
              onChangeText={setDni}
              placeholder="DNI (7 u 8 dígitos)"
              placeholderTextColor="#888"
              keyboardType="number-pad"
              maxLength={8}
            />

            {/* Teléfono */}
            <Text style={styles.inputLabel}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Teléfono (solo números, ej. +549...)"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              maxLength={16}
            />

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
                onPress={() => setIsEditing(false)}
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: '#000' },
  card: { backgroundColor: 'rgba(28,28,30,0.98)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  sub: { color: '#BDBDBD', fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  label: { color: '#E0E0E0', fontSize: 14, marginLeft: 10, width: 90 },
  value: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 },
  primaryBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD54F', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, justifyContent: 'center' },
  primaryBtnText: { color: '#0D0D0D', fontWeight: '800', marginLeft: 8 },
  inputLabel: { color: '#FFD54F', marginBottom: 4, marginTop: 8, fontWeight: '700' },
  input: { backgroundColor: '#1C1C1C', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#FFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cancelBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, justifyContent: 'center' },
  cancelBtnText: { color: '#000', fontWeight: '800', marginLeft: 8 },
});


