import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const onboarded = localStorage.getItem("wardrobe-onboarded");
    if (!onboarded) navigate("/onboarding", { replace: true });
  }, [navigate]);
  return null;
};

export default Index;
