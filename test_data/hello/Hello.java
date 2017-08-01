package hello;
import java.util.ArrayList;
import java.util.List;

public class Hello {

	public static void main(String[] args) {
		List a = new ArrayList();
        List  b = new ArrayList();
        if (a.getClass().equals(b.getClass())) {
            System.out.println("aaaaa");
        }
	}
}
