// Inventario.js — Modal crítico funcionando + buscador + filtros de colores
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  Modal, Pressable, Image, TextInput
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { auth, db } from '../src/config/firebaseConfig';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, where, getDocs } from 'firebase/firestore';
import { useIsFocused } from '@react-navigation/native';

export default function Inventario({ navigation }) {
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [insumos, setInsumos] = useState([]);
  const [criticos, setCriticos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [critModalVisible, setCritModalVisible] = useState(false);

  useEffect(() => {
    const ref = collection(db, 'insumos');
    const q = query(ref, orderBy('nombre', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInsumos(items);
      const crit = items.filter((it) => Number(it.stockActual ?? 0) <= Number(it.puntoReposicion ?? 0));
      setCriticos(crit);
      setLoading(false);
    });
    return unsub;
  }, [isFocused]);

  const toggleEstado = async (item) => {
    try {
      const nuevoEstado = (item.estado || '').toLowerCase() === 'activo' ? 'inactivo' : 'activo';
      await updateDoc(doc(db, 'insumos', item.id), { estado: nuevoEstado });
      const uid = auth.currentUser?.uid;
      if (uid) {
        const qUser = query(collection(db, 'users', uid, 'insumos'), where('globalId', '==', item.id));
        const snapUser = await getDocs(qUser);
        for (const d of snapUser.docs) await updateDoc(d.ref, { estado: nuevoEstado });
      }
    } catch (e) { console.log('toggle estado error', e); }
  };

  const insumosFiltrados = useMemo(() => {
    const normalizar = (txt) => (txt || '').toLowerCase().replace(/\s+/g, '');
    let data = insumos;

    if (filtroEstado !== 'todos')
      data = data.filter((i) => (i.estado || '').toLowerCase() === filtroEstado);

    if (filtroNivel !== 'todos')
      data = data.filter((i) => {
        const sA = Number(i?.stockActual ?? NaN);
        const sR = Number(i?.puntoReposicion ?? NaN);
        if (!Number.isFinite(sA) || !Number.isFinite(sR)) return false;
        return filtroNivel === 'encima' ? sA > sR : sA <= sR;
      });

    if (busqueda.trim() !== '') {
      const b = normalizar(busqueda);
      data = data.filter((i) => normalizar(i?.nombre ?? '').includes(b));
    }

    return data;
  }, [insumos, filtroEstado, filtroNivel, busqueda]);

  const renderItem = ({ item }) => {
    const esCritico = Number(item?.stockActual ?? 0) <= Number(item?.puntoReposicion ?? 0);
    const btnEstadoTexto = (item.estado || '').toLowerCase() === 'activo' ? 'Desactivar' : 'Activar';
    return (
      <View style={[styles.item, esCritico && styles.itemCritico]}>
        <View style={styles.leftCol}>
          <View style={styles.thumbFrame}>
            {item?.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumbInside} />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <FontAwesome name="image" size={18} color="#777" />
              </View>
            )}
          </View>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.nombre}</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[
              styles.estadoPill,
              (item.estado || '').toLowerCase() === 'activo' ? styles.estadoActivo : styles.estadoInactivo
            ]}>
              <Text style={styles.estadoText}>{(item.estado || '').toLowerCase() === 'activo' ? 'Activo' : 'Inactivo'}</Text>
            </View>
            {esCritico && (
              <View style={[styles.estadoPill, styles.estadoCritico]}>
                <Text style={styles.estadoText}>CRÍTICO</Text>
              </View>
            )}
          </View>

          <View style={styles.rowBtns}>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('DetalleInsumo', { insumoId: item.id })}
            >
              <FontAwesome name="eye" size={14} color="#000" />
              <Text style={styles.detailText}>Ver detalle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.stateBtn,
                (item.estado || '').toLowerCase() === 'activo' ? styles.stateBtnOff : styles.stateBtnOn
              ]}
              onPress={() => toggleEstado(item)}
            >
              <Text style={styles.stateBtnText}>{btnEstadoTexto}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const Chip = ({ active, label, color, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: color, borderColor: color } : styles.chipIdle,
      ]}
    >
      <Text style={[styles.chipText, active && { color: '#000', fontWeight: '800' }]}>{label}</Text>
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
                    Stock {item.stockActual} / Reposición {item.puntoReposicion} {item.unidad}
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

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={16} color="#FFD54F" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar insumo..."
          placeholderTextColor="#888"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Filtros */}
      <View style={styles.filtersGroup}>
        <Text style={styles.groupLabel}>Estado</Text>
        <View style={styles.filtersRow}>
          <Chip active={filtroEstado === 'todos'} label="Todos" color="#FFD54F" onPress={() => setFiltroEstado('todos')} />
          <Chip active={filtroEstado === 'activo'} label="Activos" color="#C6F6D5" onPress={() => setFiltroEstado('activo')} />
          <Chip active={filtroEstado === 'inactivo'} label="Inactivos" color="#FEE2E2" onPress={() => setFiltroEstado('inactivo')} />
        </View>
      </View>

      <View style={styles.filtersGroup}>
        <Text style={styles.groupLabel}>Stock punto de reposición</Text>
        <View style={styles.filtersRow}>
          <Chip active={filtroNivel === 'todos'} label="Todos" color="#FFD54F" onPress={() => setFiltroNivel('todos')} />
          <Chip active={filtroNivel === 'encima'} label="Por encima" color="#C6F6D5" onPress={() => setFiltroNivel('encima')} />
          <Chip active={filtroNivel === 'debajo'} label="Por debajo" color="#FEE2E2" onPress={() => setFiltroNivel('debajo')} />
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

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AgregarInsumo')}>
        <FontAwesome name="plus" size={18} color="#000" />
        <Text style={styles.addButtonText}>Agregar insumo</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : insumosFiltrados.length === 0 ? (
        <Text style={styles.empty}>No se encontraron resultados.</Text>
      ) : (
        <FlatList
          data={insumosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      <CriticosModal />
    </View>
  );
}

const THUMB = 70;

const styles = StyleSheet.create({
  container: { flex: 1, 
    backgroundColor: '#121212', 
    padding: 20 },
  title: { color: '#FFD54F', 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 12 },
  searchContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: '#1E1E1E', 
    borderRadius: 10,
    borderWidth: 1, 
    borderColor: '#333', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    marginBottom: 12
  },
  searchInput: { flex: 1, 
    color: '#FFF', 
    fontSize: 15 },
  filtersGroup: { marginBottom: 8 },
  groupLabel: { color: '#BDBDBD', 
    marginBottom: 6, 
    fontWeight: '700' },
  filtersRow: { flexDirection: 'row', 
    gap: 8,
    marginBottom: 8 },
  chip: { paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 999, 
    borderWidth: 1 },
  chipIdle: { backgroundColor: '#1E1E1E', 
    borderColor: '#333' },
  chipText: { color: '#DDD', 
    fontWeight: '700' },
  banner: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: '#f60505ff', 
    borderRadius: 10,
    paddingVertical: 10, 
    paddingHorizontal: 12,
    marginTop: 2, 
    marginBottom: 12,
  },
  bannerText: { color: '#000', 
    fontWeight: '800' },
  addButton: {
    flexDirection: 'row', 
    backgroundColor: '#05eecfff',
    padding: 12, 
    borderRadius: 10, 
    alignItems: 'center',
    justifyContent: 'center', 
    width: 180, 
    marginBottom: 8,
  },
  addButtonText: { color: '#000', 
    fontWeight: 'bold', 
    marginLeft: 8 },
  empty: { color: '#DDD', 
    marginTop: 20, 
    fontSize: 16 },
  item: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#1E1E1E', 
    padding: 12, 
    borderRadius: 12, 
    marginTop: 12,
    borderColor: '#333', 
    borderWidth: 1
  },
  itemCritico: { borderColor: '#F87171', 
    borderWidth: 1.5 },
  leftCol: { flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 },
  thumbFrame: {
    width: THUMB, 
    height: THUMB, 
    borderRadius: 10,
    backgroundColor: '#111',
    borderWidth: 1, 
    borderColor: '#333',
    alignItems: 'center', 
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbInside: { width: '100%', 
    height: '100%', 
    resizeMode: 'cover' },
  thumbPlaceholder: { alignItems: 'center', 
    justifyContent: 'center', 
    width: '100%', 
    height: '100%' },
  itemTitle: { color: '#FFF', 
    fontSize: 16, 
    fontWeight: '700', 
    flexShrink: 1 },
  estadoPill: { paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 999 },
  estadoActivo: { backgroundColor: '#C6F6D5' },
  estadoInactivo: { backgroundColor: '#FEE2E2' },
  estadoCritico: { backgroundColor: '#F87171' },
  estadoText: { color: '#000', 
    fontWeight: '700', 
    fontSize: 12 },
  rowBtns: { flexDirection: 'row', 
    gap: 8, 
    marginTop: 10 },
  detailBtn: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    backgroundColor: '#FFD54F', 
    borderRadius: 999,
    paddingHorizontal: 10, 
    paddingVertical: 6
  },
  detailText: { color: '#000', 
    fontWeight: '800', 
    fontSize: 12 },
  stateBtn: { paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 999 },
  stateBtnOff: { backgroundColor: '#FEE2E2' },
  stateBtnOn: { backgroundColor: '#C6F6D5' },
  stateBtnText: { color: '#000', 
    fontWeight: '800', 
    fontSize: 12 },

  // 🔹 Modal estilos
  modalBackdrop: { flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.55)', 
    justifyContent: 'center', 
    padding: 20 },
  modalCard: { backgroundColor: '#1E1E1E', 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#333' },
  modalHeader: { flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 10 },
  modalTitle: { color: '#FFD54F', 
    fontSize: 18, 
    fontWeight: '800' },
  modalClose: { paddingHorizontal: 8, 
    paddingVertical: 4, 
    backgroundColor: '#2A2A2A', 
    borderRadius: 8 },
  modalCloseText: { color: '#FFD54F', 
    fontWeight: '800' },
  modalItem: { backgroundColor: '#262626', 
    borderRadius: 10, 
    padding: 10, 
    borderWidth: 1, 
    borderColor: '#333' },
  modalItemTitle: { color: '#FFF', 
    fontWeight: '700' },
  modalItemSub: { color: '#BDBDBD', 
    marginTop: 2 },
  modalEmpty: { color: '#DDD', 
    marginVertical: 10, 
    textAlign: 'center' },
  modalBtn: { marginTop: 12, 
    backgroundColor: '#FFD54F', 
    paddingVertical: 10, 
    borderRadius: 10, 
    alignItems: 'center' },
  modalBtnText: { color: '#000', 
    fontWeight: '800' },
});











