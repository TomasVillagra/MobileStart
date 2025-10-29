import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/config/firebaseConfig';
import { FontAwesome } from '@expo/vector-icons';

export default function DetalleInsumo({ route, navigation }) {
  const { insumoId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [insumo, setInsumo] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!insumoId) {
          Alert.alert('Error', 'Falta el ID del insumo.');
          navigation.goBack();
          return;
        }
        const snap = await getDoc(doc(db, 'insumos', insumoId));
        if (!snap.exists()) {
          Alert.alert('Error', 'El insumo no existe.');
          navigation.goBack();
          return;
        }
        setInsumo({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.log('detalle insumo error', e);
        Alert.alert('Error', 'No se pudo obtener el insumo.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [insumoId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 20 }} />;

  const esCritico = Number(insumo?.stockActual ?? 0) <= Number(insumo?.puntoReposicion ?? 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Detalle de Insumo</Text>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{insumo?.nombre}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.estadoPill, (insumo?.estado || '').toLowerCase() === 'activo' ? styles.estadoActivo : styles.estadoInactivo]}>
              <Text style={styles.estadoText}>{(insumo?.estado || '').toLowerCase() === 'activo' ? 'Activo' : 'Inactivo'}</Text>
            </View>
            {esCritico && (
              <View style={styles.criticoPill}>
                <Text style={styles.criticoText}>CRÍTICO</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.row}><Text style={styles.label}>Unidad:</Text><Text style={styles.value}>{insumo?.unidad}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Stock actual:</Text><Text style={styles.value}>{insumo?.stockActual}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Punto de reposición:</Text><Text style={styles.value}>{insumo?.puntoReposicion}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Stock mínimo:</Text><Text style={styles.value}>{insumo?.stockMin}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Stock máximo:</Text><Text style={styles.value}>{insumo?.stockMax}</Text></View>

        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditarInsumo', { insumo })}>
          <FontAwesome name="pencil" size={14} color="#000" />
          <Text style={styles.editText}>Editar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  title: { color: '#FFD54F', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },

  card: { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  name: { color: '#FFF', fontSize: 18, fontWeight: '900' },

  estadoPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  estadoActivo: { backgroundColor: '#C6F6D5' },
  estadoInactivo: { backgroundColor: '#FEE2E2' },
  estadoText: { color: '#000', fontWeight: '700', fontSize: 12 },
  criticoPill: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F87171', borderRadius: 999 },
  criticoText: { color: '#000', fontWeight: '800', fontSize: 11 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  label: { color: '#BDBDBD', fontWeight: '700' },
  value: { color: '#FFF', fontWeight: '700' },

  editBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFD54F', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 12
  },
  editText: { color: '#000', fontWeight: '800' },
});
