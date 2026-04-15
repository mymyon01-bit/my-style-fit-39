import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HomePage from "./HomePage";

const Index = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("wardrobe-onboarded");
    if (!onboarded) {
      navigate("/onboarding", { replace: true });
    } else {
      setReady(true);
    }
  }, [navigate]);

  if (!ready) return null;
  return <HomePage />;
};

export default Index;
