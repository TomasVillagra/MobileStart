// AgregarInsumo.js — imagen cuadrada opcional + tope 8 dígitos en numéricos
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, InputAccessoryView, Keyboard, Image, ActivityIndicator
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import * as ImagePicker from 'expo-image-picker';

import { auth, db } from '../src/config/firebaseConfig';
import {
  collection, addDoc, serverTimestamp, doc, setDoc,
  query, where, getDocs
} from 'firebase/firestore';

// ====== CLOUDINARY (usá tus mismos valores que en Perfil) ======
const CLOUD_NAME = 'ddyf7ez3d';
const UPLOAD_PRESET = 'Upload';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export default function AgregarInsumo({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState(null);
  const [stockActual, setStockActual] = useState('');
  const [puntoReposicion, setPuntoReposicion] = useState('');
  const [stockMin, setStockMin] = useState('');
  const [stockMax, setStockMax] = useState('');
  const [estado, setEstado] = useState(null);

  // Imagen (preview local y URL final)
  const [tempImageUri, setTempImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [allEmpty, setAllEmpty] = useState(false);

  const [openUnidad, setOpenUnidad] = useState(false);
  const [itemsUnidad, setItemsUnidad] = useState([
    { label: 'u (unidad)', value: 'u' },
    { label: 'g (gramo)', value: 'g' },
    { label: 'kg (kilogramo)', value: 'kg' },
    { label: 'l (litro)', value: 'l' },
    { label: 'ml (mililitro)', value: 'ml' },
  ]);

  const [openEstado, setOpenEstado] = useState(false);
  const [itemsEstado, setItemsEstado] = useState([
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
  ]);

  // IDs únicos por campo numérico (iOS)
  const accIds = { stock: 'accStockAdd', rep: 'accRepAdd', min: 'accMinAdd', max: 'accMaxAdd' };

  // Normalizadores
  const parseIntSafe = (v) => {
    const only = String(v).replace(/\D+/g, '').slice(0, 8); // = 8 dígitos
    const n = parseInt(only, 10);
    return Number.isFinite(n) ? n : NaN;
  };
  const normalizeDigits = (t) => String(t).replace(/\D+/g, '').slice(0, 8); // = 8 dígitos
  const normalizeName = (s) => s.replace(/\s+/g, '').toLowerCase();
  const onDone = () => Keyboard.dismiss();

  // Helpers para limpiar errores/cartel “todos obligatorios”
  const clearAllEmpty = () => setAllEmpty(false);
  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: null, formato: null }));

  // Imagen: elegir desde galería (preview local, NO sube aún)
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // cuadrado
      quality: 0.85,
    });
    if (!result.canceled) setTempImageUri(result.assets?.[0]?.uri || null);
  };

  // Subir a Cloudinary (solo si hay preview y al guardar)
  const uploadImageIfAny = async () => {
    if (!tempImageUri) return null;
    try {
      setUploading(true);
      const data = new FormData();
      data.append('file', { uri: tempImageUri, type: 'image/jpeg', name: 'insumo.jpg' });
      data.append('upload_preset', UPLOAD_PRESET);
      data.append('folder', 'insumos');

      const res = await fetch(UPLOAD_URL, { method: 'POST', body: data });
      const json = await res.json();
      return json?.secure_url || null;
    } catch (e) {
      console.log('upload insumo image error', e);
      Alert.alert('Error', 'No se pudo subir la imagen.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleGuardar = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Sesión', 'No hay un usuario autenticado.');
      return;
    }

    // Si todo está vacío, mostrar cartel y salir
    if (
      !nombre.trim() &&
      !unidad &&
      !stockActual.trim() &&
      !puntoReposicion.trim() &&
      !stockMin.trim() &&
      !stockMax.trim() &&
      !estado &&
      !tempImageUri
    ) {
      setAllEmpty(true);
      setErrors({});
      return;
    } else {
      setAllEmpty(false);
    }

    let newErrors = {};
    if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio.';
    else if (nombre.trim().length < 3) newErrors.nombre = 'El nombre debe tener al menos 3 caracteres.';
    if (!unidad) newErrors.unidad = 'Seleccioná una unidad de medida.';

    if (!stockActual.trim()) newErrors.stockActual = 'El stock actual es obligatorio.';
    if (!puntoReposicion.trim()) newErrors.puntoReposicion = 'El punto de reposición es obligatorio.';
    if (!stockMin.trim()) newErrors.stockMin = 'El stock mínimo es obligatorio.';
    if (!stockMax.trim()) newErrors.stockMax = 'El stock máximo es obligatorio.';
    if (!estado) newErrors.estado = 'Seleccioná el estado.';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const sAct = parseIntSafe(stockActual);
    const sMin = parseIntSafe(stockMin);
    const sMax = parseIntSafe(stockMax);
    const sRep = parseIntSafe(puntoReposicion);

    if ([sAct, sMin, sMax, sRep].some((n) => Number.isNaN(n))) {
      setErrors({ ...newErrors, formato: 'Los valores deben ser numéricos válidos (máx. 8 dígitos).' });
      return;
    }
    if (sAct < 0 || sMin < 0 || sMax < 0 || sRep < 0) {
      setErrors({ ...newErrors, formato: 'No se permiten valores negativos.' });
      return;
    }
    if (sMin > sMax) {
      setErrors({ ...newErrors, stockMin: 'El stock mínimo no puede ser mayor que el máximo.' });
      return;
    }
    if (sRep < sMin || sRep > sMax) {
      setErrors({ ...newErrors, puntoReposicion: 'Debe estar entre mínimo y máximo.' });
      return;
    }
    if (sAct > sMax) {
      setErrors({ ...newErrors, stockActual: 'No puede superar el stock máximo.' });
      return;
    }

    const nombreNorm = normalizeName(nombre);

    try {
      setSaving(true);
      // unicidad por nombre normalizado
      const qDup = query(collection(db, 'insumos'), where('nombreNorm', '==', nombreNorm));
      const snapDup = await getDocs(qDup);
      if (!snapDup.empty) {
        setErrors({ nombre: 'Ya existe un insumo con ese nombre.' });
        setSaving(false);
        return;
      }

      // subir imagen si hay
      const imageUrl = await uploadImageIfAny();

      const payload = {
        nombre: nombre.trim(),
        nombreNorm,
        unidad,
        stockActual: sAct,
        puntoReposicion: sRep,
        stockMin: sMin,
        stockMax: sMax,
        estado,
        imageUrl: imageUrl || null, // opcional
        createdAt: serverTimestamp(),
        ownerId: uid,
        ownerEmail: auth.currentUser?.email || null,
      };

      const globalRef = await addDoc(collection(db, 'insumos'), payload);
      await setDoc(doc(collection(db, 'users', uid, 'insumos')), { ...payload, globalId: globalRef.id });

      Alert.alert('Éxito', `Insumo "${nombre.trim()}" agregado al sistema.`);
      navigation.goBack();
    } catch (e) {
      console.log('add insumo error', e);
      Alert.alert('Error', 'No se pudo guardar el insumo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#121212' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Agregar Insumo</Text>

        {/* Imagen (opcional) */}
        <Text style={styles.label}>Imagen (opcional)</Text>
        <View style={styles.imageRow}>
          {tempImageUri ? (
            <Image source={{ uri: tempImageUri }} style={styles.imageSquare} />
          ) : (
            <View style={[styles.imageSquare, styles.imagePlaceholder]}>
              <Text style={{ color: '#888', fontSize: 12 }}>Sin imagen</Text>
            </View>
          )}

          <View style={{ marginLeft: 12, justifyContent: 'center' }}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage} disabled={uploading || saving}>
              {uploading ? <ActivityIndicator /> : <Text style={styles.secondaryBtnText}>Elegir imagen</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Nombre */}
        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          placeholder="Nombre del insumo"
          placeholderTextColor="#aaa"
          value={nombre}
          onChangeText={(t) => { setNombre(t); clearAllEmpty(); clearError('nombre'); }}
          style={styles.input}
          returnKeyType="next"
          blurOnSubmit
        />
        {errors.nombre && <Text style={styles.errorText}>{errors.nombre}</Text>}

        {/* Unidad */}
        <Text style={styles.label}>Unidad de medida *</Text>
        <View style={{ zIndex: 2000 }}>
          <DropDownPicker
            open={openUnidad}
            value={unidad}
            items={itemsUnidad}
            setOpen={(v) => { setOpenUnidad(v); clearAllEmpty(); }}
            setValue={(callback) => {
              const val = callback(unidad);
              setUnidad(val);
              clearAllEmpty();
              clearError('unidad');
            }}
            setItems={setItemsUnidad}
            placeholder="Seleccioná unidad"
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            listItemLabelStyle={styles.dropdownItemLabel}
            selectedItemLabelStyle={styles.dropdownItemLabel}
            textStyle={{ color: '#FFF' }}
            placeholderStyle={styles.dropdownPlaceholder}
            listMode="SCROLLVIEW"
          />
        </View>
        {errors.unidad && <Text style={styles.errorText}>{errors.unidad}</Text>}

        {/* Stock actual */}
        <Text style={styles.label}>Stock actual *</Text>
        <TextInput
          placeholder="0"
          placeholderTextColor="#aaa"
          value={stockActual}
          onChangeText={(t) => { setStockActual(normalizeDigits(t)); clearAllEmpty(); clearError('stockActual'); }}
          keyboardType="number-pad"
          style={styles.input}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={onDone}
          inputAccessoryViewID={accIds.stock}
        />
        {errors.stockActual && <Text style={styles.errorText}>{errors.stockActual}</Text>}

        {/* Punto de reposición */}
        <Text style={styles.label}>Punto de reposición *</Text>
        <TextInput
          placeholder="Ej. 10"
          placeholderTextColor="#aaa"
          value={puntoReposicion}
          onChangeText={(t) => { setPuntoReposicion(normalizeDigits(t)); clearAllEmpty(); clearError('puntoReposicion'); }}
          keyboardType="number-pad"
          style={styles.input}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={onDone}
          inputAccessoryViewID={accIds.rep}
        />
        {errors.puntoReposicion && <Text style={styles.errorText}>{errors.puntoReposicion}</Text>}

        {/* Stock mínimo */}
        <Text style={styles.label}>Stock mínimo *</Text>
        <TextInput
          placeholder="Ej. 5"
          placeholderTextColor="#aaa"
          value={stockMin}
          onChangeText={(t) => { setStockMin(normalizeDigits(t)); clearAllEmpty(); clearError('stockMin'); }}
          keyboardType="number-pad"
          style={styles.input}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={onDone}
          inputAccessoryViewID={accIds.min}
        />
        {errors.stockMin && <Text style={styles.errorText}>{errors.stockMin}</Text>}

        {/* Stock máximo */}
        <Text style={styles.label}>Stock máximo *</Text>
        <TextInput
          placeholder="Ej. 100"
          placeholderTextColor="#aaa"
          value={stockMax}
          onChangeText={(t) => { setStockMax(normalizeDigits(t)); clearAllEmpty(); clearError('stockMax'); }}
          keyboardType="number-pad"
          style={styles.input}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={onDone}
          inputAccessoryViewID={accIds.max}
        />
        {errors.stockMax && <Text style={styles.errorText}>{errors.stockMax}</Text>}

        {/* Estado */}
        <Text style={styles.label}>Estado *</Text>
        <View style={{ zIndex: 1000 }}>
          <DropDownPicker
            open={openEstado}
            value={estado}
            items={itemsEstado}
            setOpen={(v) => { setOpenEstado(v); clearAllEmpty(); }}
            setValue={(callback) => {
              const val = callback(estado);
              setEstado(val);
              clearAllEmpty();
              clearError('estado');
            }}
            setItems={setItemsEstado}
            placeholder="Seleccioná estado"
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            listItemLabelStyle={styles.dropdownItemLabel}
            selectedItemLabelStyle={styles.dropdownItemLabel}
            textStyle={{ color: '#FFF' }}
            placeholderStyle={styles.dropdownPlaceholder}
            listMode="SCROLLVIEW"
          />
        </View>
        {errors.estado && <Text style={styles.errorText}>{errors.estado}</Text>}

        {/* Nota de obligatoriedad */}
        <Text style={styles.noteText}>Los campos con * son obligatorios</Text>

        {/* Mensaje si todo está vacío */}
        {allEmpty && <Text style={styles.allEmptyText}>Todos los campos son obligatorios</Text>}

        {/* Botones */}
        <TouchableOpacity
          style={[styles.saveButton, { opacity: saving ? 0.6 : 1 }]}
          onPress={handleGuardar}
          disabled={saving || uploading}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Barras “Listo” (iOS): una por cada campo */}
      {Platform.OS === 'ios' && (
        <>
          <InputAccessoryView nativeID={accIds.stock}>
            <View style={styles.accessoryBar}><TouchableOpacity onPress={onDone} style={styles.accessoryBtn}><Text style={styles.accessoryText}>Listo</Text></TouchableOpacity></View>
          </InputAccessoryView>
          <InputAccessoryView nativeID={accIds.rep}>
            <View style={styles.accessoryBar}><TouchableOpacity onPress={onDone} style={styles.accessoryBtn}><Text style={styles.accessoryText}>Listo</Text></TouchableOpacity></View>
          </InputAccessoryView>
          <InputAccessoryView nativeID={accIds.min}>
            <View style={styles.accessoryBar}><TouchableOpacity onPress={onDone} style={styles.accessoryBtn}><Text style={styles.accessoryText}>Listo</Text></TouchableOpacity></View>
          </InputAccessoryView>
          <InputAccessoryView nativeID={accIds.max}>
            <View style={styles.accessoryBar}><TouchableOpacity onPress={onDone} style={styles.accessoryBtn}><Text style={styles.accessoryText}>Listo</Text></TouchableOpacity></View>
          </InputAccessoryView>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const IMAGE_SIZE = 90;

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { color: '#FFD54F', 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 16 },
  label: { color: '#FFD54F', 
    fontWeight: '700', 
    marginTop: 10, 
    marginBottom: 6 },
  errorText: { color: '#FF6B6B', 
    marginTop: 4, 
    fontSize: 13 },
  allEmptyText: { color: '#FF6B6B', 
    textAlign: 'center', 
    fontSize: 15, 
    marginTop: 10, 
    marginBottom: 5 },

  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },

  dropdown: { backgroundColor: '#1E1E1E', 
    borderColor: '#333', 
    minHeight: 46 },
  dropdownContainer: { backgroundColor: '#1E1E1E', 
    borderColor: '#333' },
  dropdownItemLabel: { color: '#FFF' },
  dropdownPlaceholder: { color: '#888' },

  imageRow: { flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 6 },
  imageSquare: { width: IMAGE_SIZE, 
    height: IMAGE_SIZE, 
    borderRadius: 8, 
    backgroundColor: '#111' },
  imagePlaceholder: { borderWidth: 1, 
    borderColor: '#333', 
    alignItems: 'center', 
    justifyContent: 'center' },

  secondaryBtn: { backgroundColor: '#333', 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 8 },
  secondaryBtnText: { color: '#FFF', 
    fontWeight: '700' },

  saveButton: { backgroundColor: '#FFD54F', 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 16 },
  saveButtonText: { color: '#000', 
    fontWeight: 'bold', 
    fontSize: 16 },
  cancelButton: { backgroundColor: '#333', 
    padding: 14,
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 10 },
  cancelButtonText: { color: '#FFF', 
    fontSize: 16 },

  accessoryBar: { backgroundColor: '#1E1E1E', 
    borderTopColor: '#333', 
    borderTopWidth: 1, 
    padding: 8, 
    alignItems: 'flex-end' },
  accessoryBtn: { backgroundColor: '#FFD54F', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 8 },
  accessoryText: { color: '#000', 
    fontWeight: '700' },
  noteText: {
  color: '#FFD54F',
  fontSize: 13,
  textAlign: '',
  marginTop: 6,
  marginBottom: 4,
  fontStyle: 'italic',
},

});










