import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  Modal, Pressable
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { auth, db } from '../src/config/firebaseConfig';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, where, getDocs } from 'firebase/firestore';
import { useIsFocused } from '@react-navigation/native';

export default function Inventario({ navigation, route }) {
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [insumos, setInsumos] = useState([]);
  const [criticos, setCriticos] = useState([]);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('todos');   // 'todos' | 'activo' | 'inactivo'
  const [filtroNivel, setFiltroNivel] = useState('todos');     // 'todos' | 'encima' | 'debajo'

  // Presets desde Home
  useEffect(() => {
    if (route?.params?.presetEstado) setFiltroEstado(route.params.presetEstado);
    if (route?.params?.presetNivel) setFiltroNivel(route.params.presetNivel);
  }, [route?.params]);

  // Modal críticos
  const [critModalVisible, setCritModalVisible] = useState(false);

  useEffect(() => {
    const ref = collection(db, 'insumos');
    const q = query(ref, orderBy('nombre', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInsumos(items);

        const crit = items.filter((it) => {
          const sAct = Number(it.stockActual ?? 0);
          const sRep = Number(it.puntoReposicion ?? 0);
          return Number.isFinite(sAct) && Number.isFinite(sRep) && sAct <= sRep;
        });
        setCriticos(crit);
        setLoading(false);
      },
      (err) => {
        console.log('onSnapshot insumos error', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [isFocused]);

  const uc = (u) => (u || '').toLowerCase();

  const toggleEstado = async (item) => {
    try {
      const nuevoEstado = item.estado === 'activo' ? 'inactivo' : 'activo';
      await updateDoc(doc(db, 'insumos', item.id), { estado: nuevoEstado });

      const uid = auth.currentUser?.uid;
      if (uid) {
        const qUser = query(collection(db, 'users', uid, 'insumos'), where('globalId', '==', item.id));
        const snapUser = await getDocs(qUser);
        for (const d of snapUser.docs) {
          await updateDoc(d.ref, { estado: nuevoEstado });
        }
      }
    } catch (e) {
      console.log('toggle estado error', e);
    }
  };

  // Aplica filtros
  const insumosFiltrados = useMemo(() => {
    let data = insumos;

    if (filtroEstado !== 'todos') {
      data = data.filter((i) => (i.estado || '').toLowerCase() === filtroEstado);
    }
    if (filtroNivel !== 'todos') {
      data = data.filter((i) => {
        const sAct = Number(i?.stockActual ?? NaN);
        const sRep = Number(i?.puntoReposicion ?? NaN);
        if (!Number.isFinite(sAct) || !Number.isFinite(sRep)) return false;

        if (filtroNivel === 'encima') return sAct > sRep;
        if (filtroNivel === 'debajo') return sAct <= sRep;
        return true;
      });
    }

    return data;
  }, [insumos, filtroEstado, filtroNivel]);

  const renderItem = ({ item }) => {
    const esCritico = Number(item?.stockActual ?? 0) <= Number(item?.puntoReposicion ?? 0);
    const btnEstadoTexto = item.estado === 'activo' ? 'Desactivar' : 'Activar';

    return (
      <View style={[styles.item, esCritico && styles.itemCritico]}>
        {/* Columna izquierda: SOLO nombre */}
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.nombre}</Text>
        </View>

        {/* Columna derecha: pill estado + pill CRÍTICO en la misma línea, y botones */}
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.estadoPill, item.estado === 'activo' ? styles.estadoActivo : styles.estadoInactivo]}>
              <Text style={styles.estadoText}>{item.estado === 'activo' ? 'Activo' : 'Inactivo'}</Text>
            </View>
            {esCritico && (
              <View style={styles.criticoPillInline}>
                <Text style={styles.criticoText}>CRÍTICO</Text>
              </View>
            )}
          </View>

          <View style={styles.rowBtns}>
            {/* Ver detalle */}
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('DetalleInsumo', { insumoId: item.id })}
            >
              <FontAwesome name="eye" size={14} color="#000" />
              <Text style={styles.detailText}>Ver detalle</Text>
            </TouchableOpacity>

            {/* Activar/Desactivar */}
            <TouchableOpacity
              style={[styles.stateBtn, item.estado === 'activo' ? styles.stateBtnOff : styles.stateBtnOn]}
              onPress={() => toggleEstado(item)}
            >
              <Text style={styles.stateBtnText}>{btnEstadoTexto}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Chip
  const Chip = ({ active, label, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const CriticosModal = () => (
    <Modal visible={critModalVisible} transparent animationType="fade" onRequestClose={() => setCritModalVisible(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Insumos en punto crítico</Text>
            <Pressable onPress={() => setCritModalVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {criticos.length === 0 ? (
            <Text style={styles.modalEmpty}>No hay insumos en punto crítico.</Text>
          ) : (
            <FlatList
              data={criticos}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <View style={styles.modalItem}>
                  <Text style={styles.modalItemTitle}>{item.nombre}</Text>
                  <Text style={styles.modalItemSub}>
                    Stock {item.stockActual} / Reposición {item.puntoReposicion} {uc(item.unidad)}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingVertical: 8 }}
              style={{ maxHeight: 360 }}
            />
          )}

          <TouchableOpacity style={styles.modalBtn} onPress={() => setCritModalVisible(false)}>
            <Text style={styles.modalBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventario</Text>

      {/* FILTROS RÁPIDOS (verde/rojo) */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          style={styles.quickGreen}
          onPress={() => { setFiltroEstado('activo'); setFiltroNivel('encima'); }}
        >
          <FontAwesome name="check" size={14} color="#053B00" />
          <Text style={styles.quickGreenText}>Activos + Por encima</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickRed}
          onPress={() => { setFiltroEstado('inactivo'); setFiltroNivel('debajo'); }}
        >
          <FontAwesome name="warning" size={14} color="#3E0000" />
          <Text style={styles.quickRedText}>Inactivos + Por debajo</Text>
        </TouchableOpacity>
      </View>

      {/* FILTROS AVANZADOS (chips) */}
      <View style={styles.filtersGroup}>
        <Text style={styles.groupLabel}>Estado</Text>
        <View style={styles.filtersRow}>
          <Chip active={filtroEstado === 'todos'} label="Todos" onPress={() => setFiltroEstado('todos')} />
          <Chip active={filtroEstado === 'activo'} label="Activos" onPress={() => setFiltroEstado('activo')} />
          <Chip active={filtroEstado === 'inactivo'} label="Inactivos" onPress={() => setFiltroEstado('inactivo')} />
        </View>
      </View>

      <View style={styles.filtersGroup}>
        <Text style={styles.groupLabel}>Stock punto de reposición</Text>
        <View style={styles.filtersRow}>
          <Chip active={filtroNivel === 'todos'} label="Todos" onPress={() => setFiltroNivel('todos')} />
          <Chip active={filtroNivel === 'encima'} label="Por encima" onPress={() => setFiltroNivel('encima')} />
          <Chip active={filtroNivel === 'debajo'} label="Por debajo" onPress={() => setFiltroNivel('debajo')} />
        </View>
      </View>

      {/* Banner críticos */}
      <TouchableOpacity
        style={[styles.banner, criticos.length === 0 && { opacity: 0.6 }]}
        onPress={() => setCritModalVisible(true)}
        activeOpacity={0.9}
      >
        <FontAwesome name="exclamation-triangle" size={16} color="#000" />
        <Text style={styles.bannerText}>
          {criticos.length === 1 ? '1 insumo en punto crítico — ver' : `${criticos.length} insumos en punto crítico — ver`}
        </Text>
      </TouchableOpacity>

      {/* Agregar insumo */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AgregarInsumo')}
      >
        <FontAwesome name="plus" size={18} color="#000" />
        <Text style={styles.addButtonText}>Agregar insumo</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : insumosFiltrados.length === 0 ? (
        <Text style={styles.empty}>No hay resultados para los filtros seleccionados.</Text>
      ) : (
        <FlatList
          data={insumosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <CriticosModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  title: { color: '#FFD54F', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },

  // Barra rápida
  quickBar: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  quickGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#8AF1A2', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#4FCB71'
  },
  quickGreenText: { color: '#053B00', fontWeight: '900' },
  quickRed: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF9B9B', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#E76A6A'
  },
  quickRedText: { color: '#3E0000', fontWeight: '900' },

  // Filtros
  filtersGroup: { marginBottom: 8 },
  groupLabel: { color: '#BDBDBD', marginBottom: 6, fontWeight: '700' },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipIdle: { backgroundColor: '#1E1E1E', borderColor: '#333' },
  chipActive: { backgroundColor: '#FFD54F', borderColor: '#FFD54F' },
  chipText: { color: '#DDD', fontWeight: '700' },
  chipTextActive: { color: '#000' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f60505ff', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    marginTop: 2, marginBottom: 12,
  },
  bannerText: { color: '#000', fontWeight: '800' },

  addButton: {
    flexDirection: 'row', backgroundColor: '#05eecfff',
    padding: 12, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', width: 180, marginBottom: 8,
  },
  addButtonText: { color: '#000', fontWeight: 'bold', marginLeft: 8 },
  empty: { color: '#DDD', marginTop: 20, fontSize: 16 },

  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', padding: 12, borderRadius: 12, marginTop: 12,
    borderColor: '#333', borderWidth: 1
  },
  itemCritico: { borderColor: '#F87171', borderWidth: 1.5 },
  itemTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  estadoPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  estadoActivo: { backgroundColor: '#C6F6D5' },
  estadoInactivo: { backgroundColor: '#FEE2E2' },
  estadoText: { color: '#000', fontWeight: '700', fontSize: 12 },

  // CRÍTICO en línea con ACTIVO
  criticoPillInline: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F87171', borderRadius: 999 },

  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },

  detailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFD54F', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6
  },
  detailText: { color: '#000', fontWeight: '800', fontSize: 12 },

  stateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  stateBtnOff: { backgroundColor: '#FEE2E2' },
  stateBtnOn: { backgroundColor: '#C6F6D5' },
  stateBtnText: { color: '#000', fontWeight: '800', fontSize: 12 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#1E1E1E', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#333' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { color: '#FFD54F', fontSize: 18, fontWeight: '800' },
  modalClose: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#2A2A2A', borderRadius: 8 },
  modalCloseText: { color: '#FFD54F', fontWeight: '800' },
  modalItem: { backgroundColor: '#262626', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#333' },
  modalItemTitle: { color: '#FFF', fontWeight: '700' },
  modalItemSub: { color: '#BDBDBD', marginTop: 2 },
  modalEmpty: { color: '#DDD', marginVertical: 10, textAlign: 'center' },
  modalBtn: { marginTop: 12, backgroundColor: '#FFD54F', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#000', fontWeight: '800' },
});








