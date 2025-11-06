import React, { useState, useRef, useEffect } from 'react';
import {
  ImageBackground,
  Image,
  Text,
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Animated,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../src/config/firebaseConfig'; // db
import { collection, onSnapshot } from 'firebase/firestore'; //  Firestore
import { PieChart } from 'react-native-chart-kit'; //  PieChart agregado

export default function Home({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedSection, setSelectedSection] = useState('dashboard');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [insumosCriticos, setInsumosCriticos] = useState(0); // KPI

  const userName =
    (auth.currentUser &&
      (auth.currentUser.displayName
        ? auth.currentUser.displayName.split(' ')[0]  // toma solo la primera palabra (nombre)
        : (auth.currentUser.email ? auth.currentUser.email.split('@')[0] : null))) ||
    'Usuario';
  console.log('displayName:', auth.currentUser?.displayName);
  console.log('providerData:', auth.currentUser?.providerData);

  const MENU_W = Dimensions.get('window').width * 0.78;
  const slideAnim = useRef(new Animated.Value(-MENU_W)).current;

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -MENU_W,
      duration: 240,
      useNativeDriver: true
    }).start(() => setMenuVisible(false));
  };

  useEffect(() => {
    if (menuVisible) {
      slideAnim.setValue(-MENU_W);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true
      }).start();
    }
  }, [menuVisible]);

  // KPI: solo ACTIVOS por debajo (o igual) del punto de reposición
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'insumos'), (snap) => {
      let count = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        const estadoOk = String(d?.estado || '').toLowerCase() === 'activo';
        const sAct = Number(d?.stockActual ?? NaN);
        const sRep = Number(d?.puntoReposicion ?? NaN);
        if (estadoOk && Number.isFinite(sAct) && Number.isFinite(sRep) && sAct <= sRep) {
          count += 1;
        }
      });
      setInsumosCriticos(count);
    }, (err) => {
      console.log('Home onSnapshot(insumos) error:', err);
      setInsumosCriticos(0);
    });

    return () => unsub();
  }, []);

  // -----------------------------
  // Datos de demo (no tocar keys)
  // -----------------------------
  

  const [resumenVentas] = useState({
    efectivo: 11000,
    tarjeta: 9000, // 
    qr: 6000,      // 
    
  });

  const { width: winW } = useWindowDimensions();
  const chartW = Math.max(0, winW - 36 - 32);

  // Total del día calculado por suma de métodos
  const totalDia =
    (Number(resumenVentas.efectivo) || 0) +
    (Number(resumenVentas.tarjeta) || 0) +
    (Number(resumenVentas.qr) || 0);

  // Datos para PieChart (mismos colores que las etiquetas)
  const pieData = [
    {
      name: 'Efectivo',
      population: resumenVentas.efectivo || 0,
      color: '#43A047',
      legendFontColor: '#EDEDED',
      legendFontSize: 12
    },
    {
      name: 'Transferencia',
      population: resumenVentas.tarjeta || 0,
      color: '#FFB020',
      legendFontColor: '#EDEDED',
      legendFontSize: 12
    },
    {
      name: 'Débito',
      population: resumenVentas.qr || 0,
      color: '#1E88E5',
      legendFontColor: '#EDEDED',
      legendFontSize: 12
    }
  ];

  // Formateo moneda AR
  const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const money = (n) => fmt.format(n);

  const handleLogOut = async () => {
    try {
      await signOut(auth);

    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al cerrar sesión.');
    }
  };

  

  // Menú
  const menuItems = [
    { name: 'Inicio', icon: 'home', key: 'dashboard' },
    { name: 'Pedidos', icon: 'shopping-cart', key: 'pedidos' },
    { name: 'Ventas', icon: 'bar-chart', key: 'ventas' },
    { name: 'Caja', icon: 'money', key: 'caja' },
    { name: 'Inventario', icon: 'cube', key: 'inventario' },
    { name: 'Empleados', icon: 'users', key: 'empleados' }
    // { name: 'Configuración', icon: 'cog', key: 'configuracion' },
  ];

  const selectMenuItem = (key) => {
    closeMenu();
    if (key === 'inventario') {
      navigation.navigate('Inventario');
    } else {
      setSelectedSection(key);
    }
  };

  

  const KpiCard = ({ icon, label, value, bg }) => (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <View style={styles.kpiHeader}>
        <FontAwesome name={icon} size={20} color="#FFFFFF" />
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* KPIs */}
      <View style={styles.statsContainer}>
        <KpiCard icon="clock-o" label="Pedidos pendientes" value="4" bg="#2C2C2E" />
        <KpiCard icon="dollar" label="Ventas del día" value={money(totalDia)} bg="#2C2C2E" />
      </View>

      <View style={styles.statsContainer}>
        {/* Tap: abre Inventario con filtros Activo + Por debajo */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Inventario', { presetEstado: 'activo', presetNivel: 'debajo' })}
          style={{ flex: 1, marginHorizontal: 6 }}
        >
          <KpiCard icon="exclamation-triangle" label="Insumos críticos" value={String(insumosCriticos)} bg="#2C2C2E" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 6 }}>
          <KpiCard icon="money" label="Estado de caja" value="Abierta" bg="#2C2C2E" />
        </View>
      </View>

      {/* Resumen de ventas */}
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resumen de ventas hoy</Text>
          <View style={styles.resumenTotal}>
            <Text style={styles.resumenTotalText} numberOfLines={1} adjustsFontSizeToFit>
              {money(totalDia)}
            </Text>
            <Text style={styles.resumenTotalLabel}>Total del día</Text>
          </View>

          <View style={styles.resumenDetalle}>
            <View style={styles.resumenItem}>
              <View style={[styles.resumenDot, { backgroundColor: '#43A047' }]} />
              <Text style={styles.resumenLabel}>Efectivo</Text>
              <Text style={styles.resumenValue} numberOfLines={1} adjustsFontSizeToFit>
                {money(resumenVentas.efectivo)}
              </Text>
            </View>
            <View style={styles.resumenItem}>
              <View style={[styles.resumenDot, { backgroundColor: '#FFB020' }]} />
              <Text style={styles.resumenLabel}>Transferencia</Text>
              <Text style={styles.resumenValue} numberOfLines={1} adjustsFontSizeToFit>
                {money(resumenVentas.tarjeta)}
              </Text>
            </View>
            <View style={styles.resumenItem}>
              <View style={[styles.resumenDot, { backgroundColor: '#1E88E5' }]} />
              <Text style={styles.resumenLabel}>Débito</Text>
              <Text style={styles.resumenValue} numberOfLines={1} adjustsFontSizeToFit>
                {money(resumenVentas.qr)}
              </Text>
            </View>
          </View>

          {/* Gráfico de torta por método de pago (sin números ni leyendas) */}
        <View
  style={{
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
    borderWidth: 2,
    
    borderRadius: 16,
    paddingVertical: 15,
  }}
>
  <PieChart
    data={pieData}
    width={winW * 0.96} // Usa el 90% del ancho de la pantalla para centrarlo mejor
    height={220}
    accessor="population"
    backgroundColor="transparent"
    hasLegend={false}   
    chartConfig={{
      backgroundGradientFrom: '#1C1C1E',
      backgroundGradientTo: '#1C1C1E',
      color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
      labelColor: () => 'transparent',
    }}
    style={{
      borderRadius: 12,
      marginVertical: 8,
      marginLeft:180,
      alignSelf: 'center', // Asegura el centrado dentro del contenedor
    }}
  />
</View>


        </View>
      </View>
    </ScrollView>
  );

  const renderOtraSeccion = () => (
    <View style={styles.content}>
      <View style={styles.placeholderContent}>
        <FontAwesome name="wrench" size={60} color="#B5B5B5" />
        <Text style={styles.placeholderTitle}>
          {menuItems.find((item) => item.key === selectedSection)?.name}
        </Text>
        <Text style={styles.placeholderText}>Esta sección está en desarrollo</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setSelectedSection('dashboard')}>
          <FontAwesome name="home" size={16} color="#0D0D0D" />
          <Text style={styles.primaryBtnText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ImageBackground source={require('../assets/fondo.png')} style={styles.background} resizeMode="cover">
      {/* Overlay para oscurecer el fondo */}
      <View style={styles.dim} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={openMenu}>
          <FontAwesome name="bars" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerBrand}>
          {/*<Image source={require('../assets/logo.png')} style={styles.headerLogo} />*/}
          <Text style={styles.headerTitle}>Pizzería REX</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={() => setProfileMenuVisible((v) => !v)}>
          <FontAwesome name="user-circle" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Dropdown perfil */}
      {profileMenuVisible && (
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity style={styles.overlayTouchable} onPress={() => setProfileMenuVisible(false)} />
          <View style={styles.profileMenu}>
            <Text style={styles.profileGreeting}>¡Bienvenido {userName}!</Text>

            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                navigation.navigate('Perfil');
              }}>
              <FontAwesome name="user" size={16} color="#EDEDED" />
              <Text style={styles.profileMenuText}>Mi perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                Alert.alert(
                  'Confirmar cierre de sesión',
                  '¿Estás seguro que quieres cerrar sesión?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Cerrar sesión', style: 'destructive', onPress: () => handleLogOut() },
                  ],
                  { cancelable: true }
                );
              }}
            >
              <FontAwesome name="sign-out" size={16} color="#EDEDED" />
              <Text style={styles.profileMenuText}>Cerrar sesión</Text>
            </TouchableOpacity>

          </View>
        </View>
      )}

      {/* Contenido */}
      {selectedSection === 'dashboard' ? renderDashboard() : renderOtraSeccion()}

      {/* Menú lateral */}
      <Modal animationType="none" transparent visible={menuVisible} onRequestClose={closeMenu}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.menuModal, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.menuHeader}>
              <View style={styles.menuHeaderLeft}>
                <Image source={require('../assets/logo.png')} style={styles.menuLogo} />
                <Text style={styles.menuHeaderTitle}>Pizzería REX</Text>
              </View>
              <TouchableOpacity onPress={closeMenu}>
                <FontAwesome name="times" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuContent}>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.menuItem, selectedSection === item.key && styles.menuItemActive]}
                  onPress={() => selectMenuItem(item.key)}>
                  <FontAwesome
                    name={item.icon}
                    size={18}
                    color={selectedSection === item.key ? '#FFD54F' : '#EDEDED'}
                  />
                  <Text style={[styles.menuText, selectedSection === item.key && styles.menuTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          <TouchableOpacity style={styles.modalBackground} onPress={closeMenu} />
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // Fondo
  background: { flex: 1, 
    width: '100%', 
    height: '100%' },
  dim: { ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.65)' },

  // Header
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: 'black',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerBrand: { flexDirection: 'row', 
    alignItems: 'center' },
  headerLogo: { width: 28, 
    height: 28, 
    borderRadius: 6, 
    marginRight: 8 },
  iconBtn: { padding: 8, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '700', 
    letterSpacing: 0.3 },

   // marca
  hero: { paddingHorizontal: 18, 
    paddingTop: 10 },

  brandRow: {
    backgroundColor: 'rgba(20,20,20,0.75)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  logo: { width: 42, 
    height: 42, 
    borderRadius: 10 },
  brandTitle: { color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '700' },
  brandSubtitle: { color: '#CFCFCF', 
    fontSize: 12, 
    marginTop: 2 },

  // Contenido
  content: {
    flex: 1,
    backgroundColor: 'transparent'
  },

  // KPIs
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 14
  },
  statCard: {
    flex: 1,
    marginHorizontal: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#2C2C2E'
  },
  kpiHeader: { flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10 },
  kpiLabel: { color: '#E0E0E0', 
    fontSize: 12, 
    marginLeft: 8 },
  kpiValue: { color: '#FFFFFF', 
    fontSize: 20, 
    fontWeight: '800', 
    letterSpacing: 0.2 },

  // Secciones / Cards
  section: { paddingHorizontal: 18, 
    paddingTop: 18, 
    paddingBottom: 10 },
  sectionHeader: { flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700', 
    letterSpacing: 0.2, 
    alignSelf: 'center' },
  card: {
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    
  },

  // Resumen de ventas
  resumenTotal: {
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  resumenTotalText: { color: '#76D275', 
    fontSize: 28, 
    fontWeight: '900', 
    alignSelf: 'center' },
  resumenTotalLabel: { color: '#C9C9C9', 
    fontSize: 12, 
    marginTop: 4, 
    alignSelf: 'center' },
  resumenDetalle: { paddingTop: 12 },
  resumenItem: { flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 8 },
  resumenDot: { width: 10, 
    height: 10, 
    borderRadius: 6, 
    marginRight: 10 },
  resumenLabel: { flex: 1, 
    color: '#E0E0E0', 
    fontSize: 14 },
  resumenValue: { color: '#FFFFFF', 
    fontWeight: '700' },

  // Pedidos
  pedidoCard: {
    backgroundColor: 'rgba(38,38,40,0.95)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  pedidoHeader: { flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 },
  pedidoId: { fontSize: 14, 
    fontWeight: '800', 
    color: '#FFFFFF' },
  estadoBadge: { paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 20 },
  estadoText: { color: '#FFFFFF', 
    fontSize: 10, 
    fontWeight: '800' },
  pedidoRow: { flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 4 },
  pedidoRowEnd: { flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    justifyContent: 'flex-end' },
  pedidoMesa: { fontSize: 13, 
    color: '#D6D6D6', 
    marginLeft: 8 },
  pedidoEmpleado: { fontSize: 12, 
    color: '#BDBDBD', 
    marginLeft: 8 },
  pedidoTotal: { fontSize: 14, 
    color: '#76D275', 
    fontWeight: '800', 
    marginLeft: 6 },

  // Botones
  ghostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  ghostBtnText: { color: '#EDEDED', 
    fontWeight: '700', 
    fontSize: 12, 
    letterSpacing: 0.3 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD54F',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10
  },
  primaryBtnText: { color: '#0D0D0D', 
    fontWeight: '800', 
    marginLeft: 8 },

  // Placeholder
  placeholderContent: { flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 36 },
  placeholderTitle: { fontSize: 18, 
    fontWeight: '800', 
    color: '#FFFFFF', 
    marginTop: 18, 
    marginBottom: 10 },
  placeholderText: { fontSize: 14, 
    color: '#C9C9C9', 
    textAlign: 'center', 
    marginBottom: 24 },

  // Modal / menú lateral
  modalOverlay: { flex: 1, 
    flexDirection: 'row' },
  menuModal: { width: '78%', 
    backgroundColor: 'rgba(18,18,18,0.98)', 
    paddingTop: 46 },
  modalBackground: { flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.45)' },

  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  menuHeaderLeft: { flexDirection: 'row', 
    alignItems: 'center' },
  menuLogo: { width: 28, 
    height: 28, 
    borderRadius: 8, 
    marginRight: 10 },
  menuHeaderTitle: { color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '800' },
  menuContent: { flex: 1, 
    paddingTop: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginVertical: 2
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 213, 79, 0.12)',
    borderRightWidth: 3,
    borderRightColor: '#FFD54F'
  },
  menuText: { color: '#EDEDED', 
    marginLeft: 14, 
    fontSize: 15 },
  menuTextActive: { color: '#FFD54F', 
    fontWeight: '800' },

  // Perfil
  dropdownOverlay: { position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 30 },
  overlayTouchable: { position: 'absolute', 
    top: 0, 
    left: 0, 
    ight: 0, 
    bottom: 0 },
  profileMenu: {
    position: 'absolute',
    top: 78,
    right: 14,
    width: 220,
    backgroundColor: 'rgba(28,28,30,0.98)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  profileGreeting: { fontWeight: '800', 
    color: '#FFFFFF', 
    marginBottom: 8 },
  profileMenuItem: { flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10 },
  profileMenuText: { color: '#EDEDED', 
    fontSize: 14, 
    marginLeft: 8 }
});



