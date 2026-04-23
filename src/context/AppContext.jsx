import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";

export const AppContext = createContext();

axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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

  const setAuthToken = (token) => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  };

  const isAuth = async () => {
    try {
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
    } catch {
      toast.error("Logout failed");
    }
  };

  const fetchCartData = async () => {
    try {
      const { data } = await axios.get("/api/cart/get");

      if (data?.success) {
        setCart(data.cart || { items: [] });
      } else {
        setCart({ items: [] });
      }
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
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

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
      setMenus(data?.menuItems || []);
    } catch {
      setMenus([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoadingAuth(true);
      try {
        await isAuth();
        await Promise.all([fetchCategories(), fetchMenus()]);
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
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

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