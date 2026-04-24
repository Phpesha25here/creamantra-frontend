import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";

export const AppContext = createContext();

// ---------------- AXIOS SETUP ----------------
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
axios.defaults.withCredentials = true;

// Prevent multiple interceptors
let isInterceptorSet = false;

if (!isInterceptorSet) {
  // ✅ REQUEST INTERCEPTOR (attach token)
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // ✅ RESPONSE INTERCEPTOR (clean error handling)
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        const status = error.response.status;

        // ❌ IGNORE 401 + 404 (no spam toast)
        if (status !== 401 && status !== 404) {
          toast.error(
            error.response.data?.message || "Something went wrong",
            { id: "api-error" }
          );
        }

        // 🔥 OPTIONAL: auto logout on token expiry
        if (status === 401) {
          localStorage.removeItem("token");
        }

      } else {
        toast.error("Network error", { id: "api-error" });
      }

      return Promise.reject(error);
    }
  );

  isInterceptorSet = true;
}

// ---------------- CONTEXT ----------------
const AppContextProvider = ({ children }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(false);

  const [categories, setCategories] = useState([]);
  const [menus, setMenus] = useState([]);

  const [cart, setCart] = useState({ items: [] });
  const [totalPrice, setTotalPrice] = useState(0);

  // ---------------- TOKEN ----------------
  const setAuthToken = (token) => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  };

  // ---------------- AUTH ----------------
  const isAuth = async () => {
    try {
      const token = localStorage.getItem("token");

      // 🚫 STOP if no token (prevents 401 error)
      if (!token) {
        setUser(null);
        setAdmin(false);
        return;
      }

      const { data } = await axios.get("/api/auth/me");

      if (data?.success) {
        setUser(data.user);
        setAdmin(
          data.user?.role === "admin" || data.user?.isAdmin === true
        );
      } else {
        setUser(null);
        setAdmin(false);
      }

    } catch {
      setUser(null);
      setAdmin(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setAuthToken(null);
      setUser(null);
      setAdmin(false);
      setCart({ items: [] });
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error(error);
    }
  };

  // ---------------- CART ----------------
  const fetchCartData = async () => {
    try {
      const { data } = await axios.get("/api/cart/get");
      setCart(data?.success ? data.cart || { items: [] } : { items: [] });
    } catch {
      setCart({ items: [] });
    }
  };

  const addToCart = async (menuId) => {
    if (!user) {
      if (!toast.isActive("login-error")) {
        toast.error("Please login first", { id: "login-error" });
      }
      return;
    }

    try {
      const { data } = await axios.post("/api/cart/add", {
        menuId,
        quantity: 1,
      });

      if (data?.success) {
        toast.success(data.message);
        fetchCartData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ---------------- DATA FETCH ----------------
  const fetchCategories = async () => {
    try {
      const { data } = await axios.get("/api/category/all");
      setCategories(data?.categories || []);
    } catch {
      setCategories([]);
    }
  };

  const fetchMenus = async () => {
    try {
      const { data } = await axios.get("/api/menu/all");

      setMenus(
        data?.menuItems ||
        data?.menus ||
        data?.data ||
        []
      );
    } catch {
      setMenus([]);
    }
  };

  // ---------------- INIT ----------------
  useEffect(() => {
    const init = async () => {
      setLoadingAuth(true);
      try {
        await isAuth();
        await Promise.all([
          fetchCategories(),
          fetchMenus()
        ]);
      } finally {
        setLoadingAuth(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (user) fetchCartData();
  }, [user]);

  useEffect(() => {
    const total = (cart?.items || []).reduce((sum, item) => {
      const price = item?.menuItem?.price || 0;
      return sum + price * (item.quantity || 0);
    }, 0);

    setTotalPrice(total);
  }, [cart]);

  const cartCount =
    cart?.items?.reduce(
      (acc, item) => acc + (item.quantity || 0),
      0
    ) || 0;

  // ---------------- CONTEXT VALUE ----------------
  const value = {
    axios,
    navigate,
    loading,
    setLoading,
    loadingAuth,
    user,
    setUser,
    admin,
    setAdmin,
    logout,
    categories,
    menus,
    setMenus,
    fetchMenus,
    fetchCategories,
    cart,
    cartCount,
    totalPrice,
    addToCart,
    fetchCartData,
    setAuthToken,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;